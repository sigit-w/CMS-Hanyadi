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

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      ok: false,
      error: { code: 'FILE_TOO_LARGE', message: 'Ukuran file melebihi batas', status: 413 }
    });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_JSON', message: 'Body JSON tidak valid', status: 400 }
    });
  }

  console.error(error);
  return res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal', status: 500 }
  });
}
