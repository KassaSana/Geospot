const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    uid: { type: String, required: true, unique: true },
    profilePicture: {
        type: String,
        default: "https://res.cloudinary.com/dbmpdoet6/image/upload/v1744226231/jxz9tcyulimodvceq47f.png"
    },
    bio: { type: String, default: "" },
    firstName: { type: String },
    lastName: { type: String },
    birthday: { type: Date },
    userLevel: { type: Number, default: 1 },
    memberSince: { type: Date, default: Date.now },
    numPosts: { type: Number, default: 0 },
    numFollowers: { type: Number, default: 0 },
    numFollowing: { type: Number, default: 0 },
    spotsVisited: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastPostDay: { type: String, default: null }, // "YYYY-MM-DD" in Gainesville time
    pet: { type: String, default: null },
    petLevel: { type: Number, default: 1 },
    petName: { type: String, default: "" },
    petCurrency: { type: Number, default: 0 },
    followers: [
        {
            uid: String,
            username: String,
            email: String,
        }
    ],
    following: [
        {
            uid: String,
            username: String,
            email: String,
        }
    ],
    resetCodeHash: { type: String },
    resetCodeExpires: { type: Date },
    resetAttempts: { type: Number, default: 0 },
    photos: {
        type: [String],
        default: [],
      },
});

// Never send secrets to clients, whichever route serializes the user
const hideSecrets = (doc, ret) => {
  delete ret.password;
  delete ret.resetCodeHash;
  delete ret.resetCodeExpires;
  delete ret.resetAttempts;
  return ret;
};
UserSchema.set('toJSON', { transform: hideSecrets });
UserSchema.set('toObject', { transform: hideSecrets });

// The profile as viewerUid may see it: your name and birthday are only shown to you
UserSchema.methods.profileFor = function (viewerUid) {
  const profile = this.toObject();
  if (viewerUid !== this.uid) {
    delete profile.firstName;
    delete profile.lastName;
    delete profile.birthday;
  }
  return profile;
};

module.exports = mongoose.model("User", UserSchema);
