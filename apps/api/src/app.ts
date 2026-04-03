import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { router } from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';

const app = express();

// Middlewares de seguridad y utilidad
app.use(helmet());
app.use(cors());
app.use(express.json());

// Logger
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rutas
app.use('/api/v1', router);

// Redirigir la raíz de salud a las rutas de la API por retrocompatibilidad temporal
app.get('/health', (_req, res) => res.redirect('/api/v1/health'));
app.get('/config', (_req, res) => res.redirect('/api/v1/config'));

// Manejo de rutas no encontradas y errores
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
