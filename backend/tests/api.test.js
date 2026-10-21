const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const UserModel = require('../models/user.model');
const LocationModel = require('../models/Location');

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

const signup = (username, password = 'secret') =>
  request(app).post('/signup').send({ username, email: `${username}@test.dev`, password });

test('signup hashes the password and never returns it', async () => {
  const res = await signup('alice');
  assert.equal(res.status, 200);
  assert.equal(res.body.password, undefined);

  const stored = await UserModel.findOne({ username: 'alice' }).lean();
  assert.match(stored.password, /^\$2[aby]\$/);
});

test('signup rejects missing fields and duplicates', async () => {
  assert.equal((await request(app).post('/signup').send({ username: 'x' })).status, 400);
  await signup('alice');
  assert.equal((await signup('alice')).status, 400);
});

test('login accepts the right password and rejects others', async () => {
  await signup('alice');
  const ok = await request(app).post('/login').send({ email: 'alice@test.dev', password: 'secret' });
  assert.equal(ok.body.message, 'Success');
  assert.equal(ok.body.user.username, 'alice');

  const bad = await request(app).post('/login').send({ email: 'alice@test.dev', password: 'nope' });
  assert.equal(bad.body.message, 'Password incorrect');

  const missing = await request(app).post('/login').send({ email: 'nobody@test.dev', password: 'x' });
  assert.equal(missing.body.message, 'No record found');
});

test('login upgrades a legacy plaintext password to a hash', async () => {
  await UserModel.create({ email: 'old@test.dev', uid: 'old', username: 'old', password: 'legacy' });
  const res = await request(app).post('/login').send({ email: 'old@test.dev', password: 'legacy' });
  assert.equal(res.body.message, 'Success');

  const stored = await UserModel.findOne({ uid: 'old' }).lean();
  assert.match(stored.password, /^\$2[aby]\$/);
});

test('profile endpoints never expose the password', async () => {
  await signup('alice');
  const byEmail = await request(app).get('/user/alice@test.dev');
  assert.equal(byEmail.status, 200);
  assert.equal(byEmail.body.password, undefined);

  const profile = await request(app).post('/UserProfilePage').send({ email: 'alice@test.dev' });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.password, undefined);
});

test('savePet and updatePetName store the pet', async () => {
  await signup('alice');
  await request(app).post('/savePet').send({ email: 'alice@test.dev', selectedPet: 'pet.png' });
  const res = await request(app).post('/updatePetName').send({ email: 'alice@test.dev', petName: 'Blob' });
  assert.equal(res.body.user.pet, 'pet.png');
  assert.equal(res.body.user.petName, 'Blob');
});

test('follow and unfollow keep counts in sync', async () => {
  const a = (await signup('alice')).body;
  const b = (await signup('bob')).body;

  await request(app).post('/follow').send({ currentUserId: a.uid, targetUserId: b.uid });
  let alice = await UserModel.findOne({ uid: a.uid });
  let bob = await UserModel.findOne({ uid: b.uid });
  assert.equal(alice.numFollowing, 1);
  assert.equal(bob.numFollowers, 1);

  await request(app).post('/unfollow').send({ currentUserId: a.uid, targetUserId: b.uid });
  alice = await UserModel.findOne({ uid: a.uid });
  bob = await UserModel.findOne({ uid: b.uid });
  assert.equal(alice.numFollowing, 0);
  assert.equal(bob.numFollowers, 0);
});

test('posts show up in feeds, and likes and comments work', async () => {
  const a = (await signup('alice')).body;
  const b = (await signup('bob')).body;
  await request(app).post('/follow').send({ currentUserId: a.uid, targetUserId: b.uid });
  await request(app).post('/follow').send({ currentUserId: b.uid, targetUserId: a.uid });

  const post = (await request(app).post('/createPost').send({
    userId: b.uid, username: 'bob', imageUrl: 'img.png', location: 'Gainesville',
  })).body;
  assert.ok(post._id);

  assert.equal((await request(app).get(`/friendsFeed/${a.uid}`)).body.length, 1);
  assert.equal((await request(app).get('/localFeed/Gainesville')).body.length, 1);
  assert.equal((await request(app).get(`/userPosts/${b.uid}`)).body.length, 1);

  const liked = await request(app).post('/likePost').send({ postId: post._id, userId: a.uid });
  assert.equal(liked.body.likes, 1);
  const unliked = await request(app).post('/likePost').send({ postId: post._id, userId: a.uid });
  assert.equal(unliked.body.likes, 0);

  await request(app).post('/addComment').send({ postId: post._id, userId: a.uid, username: 'alice', text: 'nice' });
  const comments = (await request(app).get(`/comments/${post._id}`)).body;
  assert.deepEqual(comments.map(c => c.text), ['nice']);
});

test('search finds other users and flags who you follow', async () => {
  const a = (await signup('alice')).body;
  const b = (await signup('bob')).body;
  await request(app).post('/follow').send({ currentUserId: a.uid, targetUserId: b.uid });

  const res = await request(app).post('/search').send({ username: 'BO', currentUserId: a.uid });
  assert.deepEqual(res.body.map(u => [u.username, u.isFollowing]), [['bob', true]]);
});

test('locations are listed', async () => {
  await LocationModel.create({ name: 'Lake Alice', coordinates: { lat: 29.6, lng: -82.3 } });
  const res = await request(app).get('/api/locations');
  assert.deepEqual(res.body.map(l => l.name), ['Lake Alice']);
});

test('directions rejects anything that is not lat,lng', async () => {
  const res = await request(app).get('/directions?origin=1,2&destination=1,2%26key=x');
  assert.equal(res.status, 400);
});
