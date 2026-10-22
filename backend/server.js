require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const app = require('./app');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set (see .env.example)');
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
