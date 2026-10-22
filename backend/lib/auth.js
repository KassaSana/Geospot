const jwt = require('jsonwebtoken');

const TOKEN_LIFETIME = '30d';

const signToken = (user) =>
  jwt.sign({ uid: user.uid }, process.env.JWT_SECRET, { expiresIn: TOKEN_LIFETIME });

// Sets req.user = { uid } from a valid "Authorization: Bearer <token>" header
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Please log in' });
  }

  try {
    const { uid } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { uid };
    next();
  } catch {
    res.status(401).json({ message: 'Your session has expired, please log in again' });
  }
};

module.exports = { signToken, requireAuth };
