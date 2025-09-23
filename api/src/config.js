import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 8080,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/desviaciones',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_cambia_esto',
  REFRESH_JWT_SECRET: process.env.REFRESH_JWT_SECRET || 'dev_refresh_secret_cambia_esto',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  ALLOW_OPEN_REG: (process.env.ALLOW_OPEN_REG ?? 'true') === 'true',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
};
