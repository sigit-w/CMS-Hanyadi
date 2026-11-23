export class ApiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      ok: false,
      error: { code: error.code, message: error.message, status: error.status }
    });
  }
  console.error(error);
  return res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal', status: 500 }
  });
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError('VALIDATION_ERROR', 'id harus bilangan bulat positif');
  }
  return id;
}
