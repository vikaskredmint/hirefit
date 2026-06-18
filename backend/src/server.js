import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { requireInternalAuth } from "./middleware.js";
import { authRouter } from "./routes/auth.js";
import { jobsRouter } from "./routes/jobs.js";
import { candidatesRouter } from "./routes/candidates.js";
import { scoringRouter } from "./routes/scoring.js";

const app = express();

app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hirefit-backend" });
});

app.use("/api", authRouter);
app.use("/api", requireInternalAuth, jobsRouter);
app.use("/api", requireInternalAuth, candidatesRouter);
app.use("/api", requireInternalAuth, scoringRouter);

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  console.error(err);
  res.status(status).json({
    error: err.message || "Internal server error",
    details: err.details,
  });
});

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`HireFit backend listening on http://0.0.0.0:${config.port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
