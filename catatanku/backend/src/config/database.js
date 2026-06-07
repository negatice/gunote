const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB terhubung: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌ Koneksi MongoDB gagal: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
