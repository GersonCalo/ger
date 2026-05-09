import type { Response } from 'express';
import type { ZodError } from 'zod';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type ZodIssue = {
  path: (string | number)[];
  message: string;
  code: string;
};

export const zodIssuesDetails = (zodError: ZodError): { issues: ZodIssue[] } => {
  const issues: ZodIssue[] = zodError.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    code: issue.code,
  }));

  return { issues };
};

export const sendError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown
) => {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    body.error.details = details;
  }

  return res.status(status).json(body);
};
