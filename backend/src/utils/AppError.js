// An error that is safe to show to API clients. Throw (or pass to next()) an
// AppError from any route, controller or service, and the error handler turns
// it into the standard error response:
//   { "message": "...", "code": "...", "errors": { field: "..." } }
export class AppError extends Error {
  constructor(statusCode, message, { code, errors } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code || defaultCode(statusCode);
    this.errors = errors;
  }

  static badRequest(message = "The request is invalid.", errors) {
    return new AppError(400, message, { code: errors ? "VALIDATION_ERROR" : "BAD_REQUEST", errors });
  }

  static unauthorized(message = "Please log in to continue.") {
    return new AppError(401, message);
  }

  static forbidden(message = "You do not have permission to do this.") {
    return new AppError(403, message);
  }

  static notFound(message = "The requested resource was not found.") {
    return new AppError(404, message);
  }

  static conflict(message, errors) {
    return new AppError(409, message, { errors });
  }
}

const codes = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  503: "SERVICE_UNAVAILABLE",
};

function defaultCode(statusCode) {
  return codes[statusCode] || (statusCode >= 500 ? "INTERNAL_ERROR" : "ERROR");
}
