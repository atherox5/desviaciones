import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, index: true, trim: true },
  fullName: { type: String, default: '', trim: true },
  photoUrl: { type: String, default: '' },
  passHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user', index: true },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
