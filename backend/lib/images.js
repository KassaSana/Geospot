const { randomUUID } = require('crypto');
const ImageModel = require('../models/image.model');

// The app shrinks photos before sending them, so this only stops oversized uploads
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DATA_URL = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

class ImageError extends Error {}

// Stores a base64 data URL and returns the path it is served from, e.g. "/images/<uuid>"
async function saveImage(dataUrl, ownerUid) {
  const match = DATA_URL.exec(typeof dataUrl === 'string' ? dataUrl : '');
  if (!match) {
    throw new ImageError('Send a JPEG, PNG or WebP image');
  }

  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_IMAGE_BYTES) {
    throw new ImageError('That image is too large (2 MB max)');
  }

  const type = match[1] === 'jpg' ? 'jpeg' : match[1];
  const image = await ImageModel.create({ _id: randomUUID(), ownerUid, contentType: `image/${type}`, data });
  return `/images/${image._id}`;
}

module.exports = { saveImage, ImageError, MAX_IMAGE_BYTES };
