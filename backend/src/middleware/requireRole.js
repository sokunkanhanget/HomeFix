import { AppError } from "../utils/AppError.js";

// Use after requireUser. Allows only the given roles; everyone else gets 403.
export function requireRole(...roles) {
  return function checkRole(request, _response, next) {
    if (!request.user) return next(AppError.unauthorized());
    if (!roles.includes(request.user.role)) {
      return next(AppError.forbidden("Administrator access is required."));
    }
    return next();
  };
}
