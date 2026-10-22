const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';
const app = require('../app');
const mailer = require('../lib/mailer');
const UserModel = require('../models/user.model');
const LocationModel = require('../models/Location');
const { dayKey, revealTime } = require('../lib/spotClock');

let mongo;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

const signup = async (username, password = 'secret') => {
  const res = await request(app).post('/signup').send({ username, email: `${username}@test.dev`, password });
  return res.body;
};

// supertest request with the user's token attached
const as = (session) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${session.token}`),
  post: (url) => request(app).post(url).set('Authorization', `Bearer ${session.token}`),
});

const isoDay = (daysAgo) => dayKey(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000));

test('signup hashes the password and returns a session', async () => {
  const session = await signup('alice');
  assert.ok(session.token);
  assert.equal(session.user.username, 'alice');

  const stored = await UserModel.findOne({ username: 'alice' }).lean();
  assert.match(stored.password, /^\$2[aby]\$/);
  assert.equal(stored.userLevel, 1);
});

test('signup rejects missing fields and duplicates', async () => {
  assert.equal((await request(app).post('/signup').send({ username: 'x' })).status, 400);
  await signup('alice');
  const dup = await request(app).post('/signup').send({ username: 'alice', email: 'other@test.dev', password: 'x' });
  assert.equal(dup.status, 400);
});

test('login returns a session for the right password and 401 otherwise', async () => {
  await signup('alice');
  const ok = await request(app).post('/login').send({ email: 'alice@test.dev', password: 'secret' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.username, 'alice');

  const bad = await request(app).post('/login').send({ email: 'alice@test.dev', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.message, 'Password incorrect');

  const missing = await request(app).post('/login').send({ email: 'nobody@test.dev', password: 'x' });
  assert.equal(missing.status, 401);
});

test('login upgrades a legacy plaintext password to a hash', async () => {
  await UserModel.create({ email: 'old@test.dev', uid: 'old', username: 'old', password: 'legacy' });
  const res = await request(app).post('/login').send({ email: 'old@test.dev', password: 'legacy' });
  assert.equal(res.status, 200);

  const stored = await UserModel.findOne({ uid: 'old' }).lean();
  assert.match(stored.password, /^\$2[aby]\$/);
});

test('protected routes need a valid token', async () => {
  assert.equal((await request(app).get('/friendsFeed')).status, 401);
  const forged = await request(app).get('/friendsFeed').set('Authorization', 'Bearer not-a-token');
  assert.equal(forged.status, 401);
});

test('routes act as the token owner, not whoever the body names', async () => {
  const alice = await signup('alice');
  const bob = await signup('bob');

  await as(alice).post('/updatePetName').send({ email: 'bob@test.dev', petName: 'Hijacked' });
  const bobUser = await UserModel.findOne({ uid: bob.user.uid });
  const aliceUser = await UserModel.findOne({ uid: alice.user.uid });
  assert.equal(bobUser.petName, '');
  assert.equal(aliceUser.petName, 'Hijacked');
});

test('profile endpoints never expose secrets', async () => {
  const alice = await signup('alice');
  await request(app).post('/forgotPassword').send({ email: 'alice@test.dev' });

  const byEmail = await as(alice).get('/user/alice@test.dev');
  const profile = await as(alice).post('/UserProfilePage').send({ email: 'alice@test.dev' });
  for (const body of [byEmail.body, profile.body]) {
    assert.equal(body.password, undefined);
    assert.equal(body.resetCodeHash, undefined);
  }
});

test('only you can see your name and birthday', async () => {
  const alice = await signup('alice');
  const bob = await signup('bob');
  await as(alice).post('/profileDetails').send({ firstName: 'Alice', lastName: 'Gator', birthday: '2004-05-06' });

  const own = await as(alice).post('/UserProfilePage').send({ email: 'alice@test.dev' });
  assert.equal(own.body.firstName, 'Alice');

  const byEmail = await as(bob).get('/user/alice@test.dev');
  const profile = await as(bob).post('/UserProfilePage').send({ email: 'alice@test.dev' });
  for (const body of [byEmail.body, profile.body]) {
    assert.equal(body.username, 'alice');
    assert.equal(body.firstName, undefined);
    assert.equal(body.lastName, undefined);
    assert.equal(body.birthday, undefined);
  }
});

test('profile details from onboarding are saved', async () => {
  const alice = await signup('alice');
  const res = await as(alice).post('/profileDetails').send({ firstName: 'Alice', lastName: 'Gator', birthday: '2004-05-06' });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.firstName, 'Alice');
  assert.equal(new Date(res.body.user.birthday).toISOString().slice(0, 10), '2004-05-06');

  const bad = await as(alice).post('/profileDetails').send({ firstName: 'Alice', lastName: 'Gator', birthday: 'nope' });
  assert.equal(bad.status, 400);
});

test('savePet and updatePetName store the pet', async () => {
  const alice = await signup('alice');
  await as(alice).post('/savePet').send({ selectedPet: 'pet.png' });
  const res = await as(alice).post('/updatePetName').send({ petName: 'Blob' });
  assert.equal(res.body.user.pet, 'pet.png');
  assert.equal(res.body.user.petName, 'Blob');
});

test('follow and unfollow keep counts in sync, and you cannot follow yourself', async () => {
  const alice = await signup('alice');
  const bob = await signup('bob');

  await as(alice).post('/follow').send({ targetUserId: bob.user.uid });
  assert.equal((await UserModel.findOne({ uid: alice.user.uid })).numFollowing, 1);
  assert.equal((await UserModel.findOne({ uid: bob.user.uid })).numFollowers, 1);

  await as(alice).post('/unfollow').send({ targetUserId: bob.user.uid });
  assert.equal((await UserModel.findOne({ uid: alice.user.uid })).numFollowing, 0);
  assert.equal((await UserModel.findOne({ uid: bob.user.uid })).numFollowers, 0);

  assert.equal((await as(alice).post('/follow').send({ targetUserId: alice.user.uid })).status, 400);
});

test('posts show up in feeds, and likes and comments work', async () => {
  const alice = await signup('alice');
  const bob = await signup('bob');
  await as(alice).post('/follow').send({ targetUserId: bob.user.uid });
  await as(bob).post('/follow').send({ targetUserId: alice.user.uid });

  const post = (await as(bob).post('/createPost').send({ imageUrl: 'img.png', location: 'Gainesville' })).body;
  assert.equal(post.username, 'bob');

  assert.equal((await as(alice).get('/friendsFeed')).body.length, 1);
  assert.equal((await as(alice).get('/localFeed/Gainesville')).body.length, 1);
  assert.equal((await as(alice).get(`/userPosts/${bob.user.uid}`)).body.length, 1);

  assert.equal((await as(alice).post('/likePost').send({ postId: post._id })).body.likes, 1);
  assert.equal((await as(alice).post('/likePost').send({ postId: post._id })).body.likes, 0);

  const comment = await as(alice).post('/addComment').send({ postId: post._id, text: ' nice ', username: 'faked' });
  assert.equal(comment.body.comment.username, 'alice');
  const comments = (await as(alice).get(`/comments/${post._id}`)).body;
  assert.deepEqual(comments.map(c => c.text), ['nice']);
});

test('streak counts days, not posts', async () => {
  const alice = await signup('alice');
  const post = () => as(alice).post('/createPost').send({ imageUrl: 'img.png' });
  const stats = () => UserModel.findOne({ uid: alice.user.uid });

  await post();
  await post();
  let user = await stats();
  assert.deepEqual([user.streak, user.spotsVisited, user.numPosts], [1, 1, 2]);

  // Posted yesterday: today's first post extends the streak
  await UserModel.updateOne({ uid: alice.user.uid }, { lastPostDay: isoDay(1), streak: 4 });
  await post();
  user = await stats();
  assert.deepEqual([user.streak, user.spotsVisited], [5, 2]);

  // Missed a day: the streak starts over
  await UserModel.updateOne({ uid: alice.user.uid }, { lastPostDay: isoDay(3), streak: 9 });
  await post();
  assert.equal((await stats()).streak, 1);
});

test('profile shows a broken streak as 0 before the next post', async () => {
  const alice = await signup('alice');
  await UserModel.updateOne({ uid: alice.user.uid }, { lastPostDay: isoDay(3), streak: 9 });
  const profile = await as(alice).post('/UserProfilePage').send({ email: 'alice@test.dev' });
  assert.equal(profile.body.streak, 0);
});

test('updateProfile refuses a username someone else has', async () => {
  const alice = await signup('alice');
  await signup('bob');
  const res = await as(alice).post('/updateProfile').send({ username: 'bob', bio: '' });
  assert.equal(res.status, 400);
});

test('search finds other users, flags who you follow and treats input literally', async () => {
  const alice = await signup('alice');
  const bob = await signup('bob');
  await as(alice).post('/follow').send({ targetUserId: bob.user.uid });

  const res = await as(alice).post('/search').send({ username: 'BO' });
  assert.deepEqual(res.body.map(u => [u.username, u.isFollowing]), [['bob', true]]);

  const regex = await as(alice).post('/search').send({ username: '.*' });
  assert.deepEqual(regex.body, []);
});

test('password reset works with the emailed code and only that code', async () => {
  await signup('alice');
  let sentCode;
  mailer.sendPasswordResetCode = async (email, code) => { sentCode = code; };

  const unknown = await request(app).post('/forgotPassword').send({ email: 'nobody@test.dev' });
  const known = await request(app).post('/forgotPassword').send({ email: 'alice@test.dev' });
  assert.equal(unknown.body.message, known.body.message);
  assert.match(sentCode, /^\d{6}$/);

  const wrong = sentCode === '000000' ? '111111' : '000000';
  const bad = await request(app).post('/resetPassword').send({ email: 'alice@test.dev', code: wrong, newPassword: 'new' });
  assert.equal(bad.status, 400);

  const ok = await request(app).post('/resetPassword').send({ email: 'alice@test.dev', code: sentCode, newPassword: 'new' });
  assert.equal(ok.status, 200);
  assert.equal((await request(app).post('/login').send({ email: 'alice@test.dev', password: 'new' })).status, 200);

  // The code is single use
  const again = await request(app).post('/resetPassword').send({ email: 'alice@test.dev', code: sentCode, newPassword: 'x' });
  assert.equal(again.status, 400);
});

test('password reset locks after too many wrong codes', async () => {
  await signup('alice');
  let sentCode;
  mailer.sendPasswordResetCode = async (email, code) => { sentCode = code; };
  await request(app).post('/forgotPassword').send({ email: 'alice@test.dev' });

  const wrong = sentCode === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) {
    await request(app).post('/resetPassword').send({ email: 'alice@test.dev', code: wrong, newPassword: 'x' });
  }
  const res = await request(app).post('/resetPassword').send({ email: 'alice@test.dev', code: sentCode, newPassword: 'x' });
  assert.equal(res.status, 400);
});

test("today's spot is the same for everyone and hidden until the reveal", async () => {
  const alice = await signup('alice');
  const bob = await signup('bob');
  await LocationModel.create([
    { name: 'Lake Alice', coordinates: { lat: 29.64, lng: -82.35 } },
    { name: 'Century Tower', coordinates: { lat: 29.65, lng: -82.34 } },
    { name: 'Retired', coordinates: { lat: 0, lng: 0 }, isActive: false },
  ]);

  const a = (await as(alice).get('/api/locations/today')).body;
  const b = (await as(bob).get('/api/locations/today')).body;
  assert.deepEqual(a, b);
  assert.equal(a.day, dayKey());
  assert.equal(a.revealAt, revealTime(dayKey()).toISOString());

  const shouldBeRevealed = Date.now() >= revealTime(dayKey()).getTime();
  assert.equal(a.revealed, shouldBeRevealed);
  if (shouldBeRevealed) {
    assert.ok(['Lake Alice', 'Century Tower'].includes(a.spot.name));
  } else {
    assert.equal(a.spot, null);
  }
});

test('locations are listed', async () => {
  const alice = await signup('alice');
  await LocationModel.create({ name: 'Lake Alice', coordinates: { lat: 29.6, lng: -82.3 } });
  const res = await as(alice).get('/api/locations');
  assert.deepEqual(res.body.map(l => l.name), ['Lake Alice']);
});

test('directions rejects anything that is not lat,lng', async () => {
  const alice = await signup('alice');
  const res = await as(alice).get('/directions?origin=1,2&destination=1,2%26key=x');
  assert.equal(res.status, 400);
});
