const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Tidak terautentikasi' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ message: 'User tidak ditemukan' });
    next();
  } catch {
    res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa' });
  }
};

module.exports = { protect };
