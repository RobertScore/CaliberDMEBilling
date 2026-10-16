import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import crypto from "node:crypto";
import { ZodError } from "zod";
import { authRouter } from "./routes/auth";
import { codesRouter } from "./routes/codes";
import { patientsRouter } from "./routes/patients";
import { ledgerRouter } from "./routes/ledger";
import { HttpError } from "./middleware";
import { IS_PRODUCTION } from "./config";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  // API responses hold patient data: never cache them.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Sessions log out after 15 minutes without activity (CLAUDE.md 3.2; ASSUMPTION Q-007).
  // Local development keeps sessions in memory. Production needs a database-backed store.
  app.use(
    session({
      name: "cdb.sid",
      secret: process.env.SESSION_SECRET ?? crypto.randomBytes(32).toString("hex"),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { httpOnly: true, sameSite: "strict", secure: IS_PRODUCTION, maxAge: 15 * 60 * 1000 },
    }),
  );

  app.use(authRouter);
  app.use(codesRouter);
  app.use(patientsRouter);
  app.use(ledgerRouter);

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));

  // Errors: plain messages for the screen. Never echo patient data into logs.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "),
      });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    // Database errors arrive wrapped ("Failed query: ..."); the database's own reason is in .cause.
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
    const msg = cause || (err instanceof Error ? err.message : String(err));
    // Database guard rails (append-only, closed periods) raise readable messages.
    if (/can never be edited or deleted|Books are closed/.test(msg)) return res.status(409).json({ message: msg.replace(/^.*?ERROR:\s*/, "") });
    console.error("Unexpected error:", err instanceof Error ? err.name : "unknown", err instanceof Error ? err.stack?.split("\n")[1] : "");
    res.status(500).json({ message: "Something went wrong. Please try again." });
  });

  return app;
}
