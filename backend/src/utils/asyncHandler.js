// Wraps an async Express handler so a rejected promise reaches the central
// error handler instead of being lost. Express 5 already does this for
// promises, but using the wrapper keeps controllers explicit and portable.
export function asyncHandler(handler) {
  return function wrappedHandler(request, response, next) {
    return Promise.resolve(handler(request, response, next)).catch(next);
  };
}
