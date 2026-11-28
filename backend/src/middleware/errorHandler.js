import { AppError } from "../utils/AppError.js";

// Catches requests that matched no route.
export function notFound(request, _response, next) {
  next(AppError.notFound(`Route ${request.method} ${request.originalUrl} was not found.`));
}

// Converts every error into the standard error response:
//   { "message": "...", "code": "...", "errors": { ... } }
// "message" is always present and safe to display. "errors" (field -> message)
// is included only for validation problems. Unexpected errors are logged on the
// server and returned as a generic 500 without internal details.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, _request, response, _next) {
  const normalized = normalizeError(error);

  if (normalized.statusCode >= 500) {
    console.error("Unhandled API error:", error);
  }

  if (response.headersSent) return;

  const body = { message: normalized.message, code: normalized.code };
  if (normalized.errors) body.errors = normalized.errors;
  response.status(normalized.statusCode).json(body);
}

function normalizeError(error) {
  if (error instanceof AppError) return error;

  // Malformed JSON request bodies (raised by express.json()).
  if (error?.type === "entity.parse.failed") {
    return new AppError(400, "The request body must be valid JSON.", { code: "INVALID_JSON" });
  }
  if (error?.type === "entity.too.large") {
    return new AppError(413, "The request body is too large.");
  }

  // Errors raised by Express/body-parser with a client status code.
  const status = error?.status || error?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return new AppError(status, error.expose && error.message ? error.message : "The request could not be processed.");
  }

  return new AppError(500, "Something went wrong. Please try again later.");
}
