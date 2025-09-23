import mongoose from 'mongoose';

const fotoSchema = new mongoose.Schema({
  url: String,
  nota: String,
}, { _id: false });

const reportSchema = new mongoose.Schema({
  folio: { type: String, unique: true, index: true },
  fecha: String,
  hora: String,
  reportante: String,
  area: String,
  ubicacion: String,
  tipo: String,
  severidad: String,
  descripcion: String,
  causas: String,
  acciones: String,
  responsable: String,
  compromiso: String,
  tags: String,
  fotos: [fotoSchema],
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  ownerName: String,
}, { timestamps: true });

export default mongoose.model('Report', reportSchema);
