require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const app = require('./app');
const { seedIfEmpty } = require('./seedLocations');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set (see .env.example)');
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .then(seedIfEmpty)
  .catch((err) => console.error('Database startup error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
