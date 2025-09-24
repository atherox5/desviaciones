import mongoose from 'mongoose';

const FotoSchema = new mongoose.Schema(
  { url: { type: String, required: true }, nota: { type: String, default: '' } },
  { _id: false }
);

const ShiftSummarySchema = new mongoose.Schema(
  {
    fecha: { type: String, required: true }, // YYYY-MM-DD
    area: { type: String, required: true },
    novedades: { type: String, required: true },
    fotos: { type: [FotoSchema], default: [] },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    ownerName: { type: String, required: true },
  },
  { timestamps: true }
);

ShiftSummarySchema.index({ ownerId: 1, fecha: -1 });

export default mongoose.model('ShiftSummary', ShiftSummarySchema);
