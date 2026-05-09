import { createHash } from 'crypto';
import { prisma } from '../db/prisma.js';
import type { Response } from 'express';
import { sendError } from './apiError.js';

export const canonicalizePayload = (payload: Record<string, unknown>): string => {
  const sorted = Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
};

export const hashPayload = (payload: Record<string, unknown>): string => {
  return createHash('sha256').update(canonicalizePayload(payload)).digest('hex');
};

export type IdempotencyResult<T> =
  | { action: 'create'; existing?: never }
  | { action: 'return-existing'; existing: { responseStatus: number; responseBody: unknown } }
  | { action: 'conflict'; existing?: never };

export const checkIdempotency = async (
  userId: string,
  endpoint: string,
  idempotencyKey: string,
  requestHash: string
): Promise<IdempotencyResult<unknown>> => {
  const existing = await prisma.idempotencyRequest.findUnique({
    where: {
      userId_endpoint_idempotencyKey: {
        userId,
        endpoint,
        idempotencyKey,
      },
    },
  });

  if (!existing) {
    return { action: 'create' };
  }

  if (existing.requestHash === requestHash) {
    return {
      action: 'return-existing',
      existing: {
        responseStatus: existing.responseStatus,
        responseBody: existing.responseBody as unknown,
      },
    };
  }

  return { action: 'conflict' };
};

export const saveIdempotencyRecord = async (
  userId: string,
  endpoint: string,
  idempotencyKey: string,
  requestHash: string,
  responseStatus: number,
  responseBody: unknown
) => {
  await prisma.idempotencyRequest.create({
    data: {
      userId,
      endpoint,
      idempotencyKey,
      requestHash,
      responseStatus,
      responseBody: responseBody as any,
    },
  });
};

export const handleIdempotencyConflict = (res: Response) => {
  return sendError(res, 409, 'IDEMPOTENCY_KEY_CONFLICT', 'La idempotencyKey ya fue usada con datos distintos');
};

export const returnExistingIdempotentResponse = (
  res: Response,
  existing: { responseStatus: number; responseBody: unknown }
) => {
  return res.status(existing.responseStatus).json(existing.responseBody);
};
