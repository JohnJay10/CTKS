const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

//Hashing the password before saving
AdminSchema.pre('save', async function (next) {
  const admin = this;
  if (admin.isModified('password')) {
    admin.password = await bcrypt.hash(admin.password, 8);
  }
  next();
});

//Method to compare password
AdminSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
}

module.exports = mongoose.model('Admin', AdminSchema);