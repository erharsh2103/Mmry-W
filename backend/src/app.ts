/*
 * Express application: security middleware, the /api/v1 routes and error
 * handling. Kept separate from server.ts so tests can build the app without
 * binding a port.
 */
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { CSRF_HEADER } from "./middleware/csrf.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { requestContext } from "./middleware/requestContext.js";
import { apiRoutes } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY_HOPS);

  app.use(requestContext);
  // A JSON API serves no documents, so the strictest policy applies.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["authorization", "content-type", CSRF_HEADER, "x-request-id"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.setHeader("cache-control", "no-store");
    next();
  });

  app.use("/api/v1", apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
