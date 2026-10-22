// Runs the API against a throwaway in-memory MongoDB with the seed locations.
// No .env needed: handy for trying the app locally (EXPO_PUBLIC_API_URL=http://<your-ip>:3000).
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET ??= 'local-dev-secret';
const app = require('../app');
const LocationModel = require('../models/Location');
const { locations } = require('../seedLocations');

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await LocationModel.insertMany(locations);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`In-memory API running on http://localhost:${PORT} (data is lost on exit)`);
  });
})();
