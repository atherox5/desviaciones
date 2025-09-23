import mongoose from 'mongoose';

const FotoSchema = new mongoose.Schema(
  { url: { type: String, required: true }, nota: { type: String, default: '' } },
  { _id: false }
);

const ReportSchema = new mongoose.Schema(
  {
    folio: { type: String, required: true, unique: true, immutable: true }, // <- inmutable
    fecha: { type: String, required: true },   // "YYYY-MM-DD"
    hora: { type: String, required: true },    // "HH:mm"
    reportante: { type: String, default: '' },
    area: { type: String, default: '' },
    ubicacion: { type: String, default: '' },
    tipo: { type: String, required: true },
    severidad: { type: String, required: true },
    descripcion: { type: String, required: true },
    causas: { type: String, default: '' },
    acciones: { type: String, default: '' },
    responsable: { type: String, default: '' },
    compromiso: { type: String, default: '' },
    tags: { type: String, default: '' },
    fotos: { type: [FotoSchema], default: [] },
    status: {                                  // <- estado del flujo
      type: String,
      enum: ['pendiente', 'tratamiento', 'concluido'],
      default: 'pendiente',
      index: true
    },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    ownerName: { type: String, required: true }
  },
  { timestamps: true }
);

ReportSchema.index({ folio: 1 }, { unique: true });
ReportSchema.index({ createdAt: -1 });

export default mongoose.model('Report', ReportSchema);
