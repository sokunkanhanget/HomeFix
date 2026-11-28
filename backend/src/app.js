import express from "express";
import apiRouter from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

// Builds the Express application without starting a server, so tests can
// mount it on an ephemeral port.
export function createApp({ router = apiRouter } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
