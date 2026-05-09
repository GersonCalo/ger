import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err._apiError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.errorCode,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  const devDetails = env.NODE_ENV === 'development' ? { message: err.message, stack: err.stack } : undefined;

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor',
      ...(devDetails ? { details: devDetails } : {}),
    },
  });
};
