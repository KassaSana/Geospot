const mongoose = require('mongoose');

// Uploaded photos live in the database, so the API needs no separate file storage
const imageSchema = new mongoose.Schema({
  _id: { type: String }, // random UUID, so image URLs can't be guessed
  ownerUid: { type: String, required: true },
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Image', imageSchema);
