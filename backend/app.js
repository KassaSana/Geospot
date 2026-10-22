const express = require('express');
const cors = require('cors');
const { randomUUID, randomInt } = require('crypto');
const bcrypt = require('bcryptjs');
const UserModel = require('./models/user.model');
const PostModel = require('./models/post.model');
const ImageModel = require('./models/image.model');
const { saveImage, ImageError } = require('./lib/images');
const mailer = require('./lib/mailer');
const { getUserProfile } = require('./controllers/user.controller');
const locationsRouter = require('./routes/locations');
const { signToken, requireAuth } = require('./lib/auth');
const { dayKey, daysBetween } = require('./lib/spotClock');

const app = express();

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RESET_CODE_LIFETIME_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;

const serverError = (res, label, err) => {
  console.error(`Error in ${label}:`, err);
  res.status(500).json({ message: "Server error" });
};

const sessionFor = (user) => ({
  token: signToken(user),
  user: { uid: user.uid, email: user.email, username: user.username },
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '4mb' })); // room for one 2 MB image as base64
// Express 5 leaves req.body undefined when there is no JSON body; keep the Express 4 behavior
app.use((req, res, next) => {
  req.body ??= {};
  next();
});

// ---- Public routes ----

app.get('/health', (req, res) => res.json({ ok: true }));

// Served without a token so the app's <Image> can load them; ids are random UUIDs
app.get('/images/:id', async (req, res) => {
  try {
    const image = await ImageModel.findById(req.params.id);
    if (!image) return res.status(404).json({ message: "Image not found" });
    res.set({
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(image.data);
  } catch (err) {
    serverError(res, '/images', err);
  }
});

app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Username, email and password are required" });
    }

    if (await UserModel.findOne({ email })) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (await UserModel.findOne({ username })) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const newUser = await UserModel.create({
      username,
      email,
      password: await bcrypt.hash(password, 10),
      uid: randomUUID(),
    });

    res.json(sessionFor(newUser));
  } catch (err) {
    serverError(res, '/signup', err);
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(401).json({ message: "No account found with that email" });
    }

    let passwordMatches;
    if (isBcryptHash(user.password)) {
      passwordMatches = await bcrypt.compare(password || '', user.password);
    } else {
      // Account created before hashing: check the plaintext once, then upgrade it
      passwordMatches = Boolean(password) && user.password === password;
      if (passwordMatches) {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      }
    }

    if (!passwordMatches) {
      return res.status(401).json({ message: "Password incorrect" });
    }

    res.json(sessionFor(user));
  } catch (err) {
    serverError(res, '/login', err);
  }
});

// Always answers the same way so it can't be used to discover which emails have accounts
app.post('/forgotPassword', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!mailer.canSend()) {
    return res.status(503).json({ message: "Password reset by email isn't set up on this server yet" });
  }

  try {
    const user = await UserModel.findOne({ email });
    if (user) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      user.resetCodeHash = await bcrypt.hash(code, 10);
      user.resetCodeExpires = new Date(Date.now() + RESET_CODE_LIFETIME_MS);
      user.resetAttempts = 0;
      await user.save();
      await mailer.sendPasswordResetCode(email, code);
    }
    res.json({ message: "If that email has an account, a reset code is on its way" });
  } catch (err) {
    serverError(res, '/forgotPassword', err);
  }
});

app.post('/resetPassword', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: "Email, code and new password are required" });
  }

  try {
    const user = await UserModel.findOne({ email });
    const usable = user?.resetCodeHash
      && user.resetCodeExpires > new Date()
      && user.resetAttempts < MAX_RESET_ATTEMPTS;
    if (!usable) {
      return res.status(400).json({ message: "That code has expired, request a new one" });
    }

    if (!(await bcrypt.compare(String(code), user.resetCodeHash))) {
      user.resetAttempts += 1;
      await user.save();
      return res.status(400).json({ message: "That code is not correct" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCodeHash = undefined;
    user.resetCodeExpires = undefined;
    user.resetAttempts = 0;
    await user.save();
    res.json({ message: "Password updated" });
  } catch (err) {
    serverError(res, '/resetPassword', err);
  }
});

// ---- Everything below needs a logged-in user (req.user.uid) ----

app.use(requireAuth);

app.use('/api/locations', locationsRouter);

const findCurrentUser = (req) => UserModel.findOne({ uid: req.user.uid });

app.post('/profileDetails', async (req, res) => {
  const { firstName, lastName, birthday } = req.body;
  const birthdayDate = new Date(birthday);
  if (!firstName || !lastName || Number.isNaN(birthdayDate.getTime())) {
    return res.status(400).json({ message: "First name, last name and a valid birthday are required" });
  }

  try {
    const user = await UserModel.findOneAndUpdate(
      { uid: req.user.uid },
      { firstName, lastName, birthday: birthdayDate },
      { returnDocument: 'after' }
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Profile details saved", user });
  } catch (err) {
    serverError(res, '/profileDetails', err);
  }
});

app.post('/savePet', async (req, res) => {
  const { selectedPet } = req.body;

  try {
    const user = await UserModel.findOneAndUpdate(
      { uid: req.user.uid },
      { pet: selectedPet, petLevel: 1, petCurrency: 0 },
      { returnDocument: 'after' }
    );

    if (user) {
      res.json({ message: "Pet saved successfully", user });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    serverError(res, '/savePet', err);
  }
});

app.post('/UserProfilePage', getUserProfile);

app.post('/updatePetName', async (req, res) => {
  const { petName } = req.body;
  try {
    const user = await UserModel.findOneAndUpdate(
      { uid: req.user.uid },
      { petName: petName },
      { returnDocument: 'after' }
    );
    if (user) {
      res.json({ message: "Pet name updated", user });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    serverError(res, '/updatePetName', err);
  }
});

app.post('/createPost', async (req, res) => {
  const { imageUrl, description, location } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ message: "A post needs a photo" });
  }

  try {
    const user = await findCurrentUser(req);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const newPost = await PostModel.create({
      userId: user.uid,
      username: user.username,
      userProfilePicture: user.profilePicture,
      imageUrl,
      description,
      location,
    });

    // There is one spot a day, so the first post of a day is a visit and extends the streak
    const today = dayKey();
    if (user.lastPostDay !== today) {
      const postedYesterday = user.lastPostDay && daysBetween(user.lastPostDay, today) === 1;
      user.streak = postedYesterday ? user.streak + 1 : 1;
      user.spotsVisited += 1;
      user.lastPostDay = today;
    }
    user.numPosts += 1;
    await user.save();

    res.json(newPost);
  } catch (err) {
    serverError(res, '/createPost', err);
  }
});

// Posts from people who follow you back
app.get('/friendsFeed', async (req, res) => {
  try {
    const user = await findCurrentUser(req);
    if (!user) return res.status(404).json({ message: "User not found" });

    const followerUids = new Set(user.followers.map(f => f.uid));
    const mutualUids = user.following.map(f => f.uid).filter(uid => followerUids.has(uid));

    const posts = await PostModel.find({ userId: { $in: mutualUids } }).sort({ date: -1 });
    res.json(posts);
  } catch (err) {
    serverError(res, '/friendsFeed', err);
  }
});

app.get('/localFeed/:location', async (req, res) => {
  try {
    const posts = await PostModel.find({ location: req.params.location }).sort({ date: -1 });
    res.json(posts);
  } catch (err) {
    serverError(res, '/localFeed', err);
  }
});

app.get('/user/:email', async (req, res) => {
  try {
    const user = await UserModel.findOne({ email: req.params.email });
    if (user) {
      res.json(user.profileFor(req.user.uid));
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    serverError(res, '/user', err);
  }
});

const refreshFollowCounts = async (uid) => {
  const user = await UserModel.findOne({ uid });
  user.numFollowing = user.following.length;
  user.numFollowers = user.followers.length;
  await user.save();
};

app.post('/follow', async (req, res) => {
  const { targetUserId } = req.body;

  try {
    if (targetUserId === req.user.uid) {
      return res.status(400).json({ message: "You can't follow yourself" });
    }

    const currentUser = await findCurrentUser(req);
    const targetUser = await UserModel.findOne({ uid: targetUserId });
    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User(s) not found" });
    }

    const summary = (user) => ({ uid: user.uid, username: user.username, email: user.email });
    await UserModel.updateOne({ uid: currentUser.uid }, { $addToSet: { following: summary(targetUser) } });
    await UserModel.updateOne({ uid: targetUser.uid }, { $addToSet: { followers: summary(currentUser) } });

    await refreshFollowCounts(currentUser.uid);
    await refreshFollowCounts(targetUser.uid);

    res.json({ message: "Followed successfully" });
  } catch (err) {
    serverError(res, '/follow', err);
  }
});

app.post('/unfollow', async (req, res) => {
  const { targetUserId } = req.body;

  try {
    const currentUser = await findCurrentUser(req);
    const targetUser = await UserModel.findOne({ uid: targetUserId });
    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User(s) not found" });
    }

    await UserModel.updateOne({ uid: currentUser.uid }, { $pull: { following: { uid: targetUser.uid } } });
    await UserModel.updateOne({ uid: targetUser.uid }, { $pull: { followers: { uid: currentUser.uid } } });

    await refreshFollowCounts(currentUser.uid);
    await refreshFollowCounts(targetUser.uid);

    res.json({ message: "Unfollowed successfully" });
  } catch (err) {
    serverError(res, '/unfollow', err);
  }
});

app.post('/updateProfilePicture', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: "No image provided" });

  try {
    const profilePicture = await saveImage(image, req.user.uid);
    const user = await UserModel.findOneAndUpdate(
      { uid: req.user.uid },
      { profilePicture },
      { returnDocument: 'after' }
    );

    if (user) {
      res.json({ message: "Profile picture updated", user });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    if (err instanceof ImageError) return res.status(400).json({ message: err.message });
    serverError(res, '/updateProfilePicture', err);
  }
});

app.post('/updateProfile', async (req, res) => {
  const { username, bio } = req.body;

  try {
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const taken = await UserModel.findOne({ username, uid: { $ne: req.user.uid } });
    if (taken) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const user = await UserModel.findOneAndUpdate(
      { uid: req.user.uid },
      { username, bio },
      { returnDocument: 'after' }
    );

    if (user) {
      res.json({ message: "Profile updated successfully", user });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    serverError(res, '/updateProfile', err);
  }
});

app.post('/search', async (req, res) => {
  const { username } = req.body;

  try {
    if (!username) {
      return res.status(400).json({ message: "Missing username" });
    }

    const currentUser = await findCurrentUser(req);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user not found' });
    }

    const results = await UserModel.find({
      username: { $regex: escapeRegex(username), $options: 'i' },
      uid: { $ne: currentUser.uid },
    }).limit(25);

    const followingSet = new Set(currentUser.following.map(f => f.uid));

    res.json(results.map(user => ({
      uid: user.uid,
      username: user.username,
      email: user.email,
      isFollowing: followingSet.has(user.uid),
    })));
  } catch (err) {
    serverError(res, '/search', err);
  }
});

app.post('/uploadPhoto', async (req, res) => {
  const { image } = req.body;

  try {
    if (!image) return res.status(400).json({ message: "No image provided" });

    res.json({ imageUrl: await saveImage(image, req.user.uid) });
  } catch (err) {
    if (err instanceof ImageError) return res.status(400).json({ message: err.message });
    serverError(res, '/uploadPhoto', err);
  }
});

app.get('/followers/:userId', async (req, res) => {
  try {
    const user = await UserModel.findOne({ uid: req.params.userId });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.followers);
  } catch (err) {
    serverError(res, '/followers', err);
  }
});

app.get('/following/:userId', async (req, res) => {
  try {
    const user = await UserModel.findOne({ uid: req.params.userId });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.following);
  } catch (err) {
    serverError(res, '/following', err);
  }
});

app.get('/userPosts/:uid', async (req, res) => {
  try {
    const posts = await PostModel.find({ userId: req.params.uid }).sort({ date: -1 });
    res.json(posts);
  } catch (err) {
    serverError(res, '/userPosts', err);
  }
});

// Like/unlike post
app.post('/likePost', async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.uid;

    const post = await PostModel.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const isLiked = post.likes.includes(userId);
    if (isLiked) {
      post.likes = post.likes.filter(id => id !== userId);
    } else {
      post.likes.push(userId);
    }
    await post.save();

    res.json({
      message: isLiked ? "Post unliked" : "Post liked",
      likes: post.likes.length
    });
  } catch (err) {
    serverError(res, '/likePost', err);
  }
});

app.post('/addComment', async (req, res) => {
  try {
    const { postId, text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const [post, user] = await Promise.all([PostModel.findById(postId), findCurrentUser(req)]);
    if (!post || !user) {
      return res.status(404).json({ message: "Post not found" });
    }

    const newComment = {
      userId: user.uid,
      username: user.username,
      userProfilePicture: user.profilePicture,
      text: text.trim(),
      date: new Date()
    };

    post.comments.push(newComment);
    await post.save();

    res.json({
      message: "Comment added successfully",
      comment: newComment
    });
  } catch (err) {
    serverError(res, '/addComment', err);
  }
});

app.get('/comments/:postId', async (req, res) => {
  try {
    const post = await PostModel.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(post.comments);
  } catch (err) {
    serverError(res, '/comments', err);
  }
});

module.exports = app;
