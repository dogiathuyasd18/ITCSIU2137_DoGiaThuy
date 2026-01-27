import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/connectDB.js";
import configViewEngine from "./config/viewEngine.js";
import initWebRoutes from "./route/web.js";

dotenv.config();

const app = express();

// Basic middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Views + static assets
configViewEngine(app);

// Routes
initWebRoutes(app);

// Health check (useful to verify the server stays up)
app.get("/api/health", (_req, res) => {
  return res.status(200).json({ ok: true });
});

const port = process.env.PORT || 8080;

// Start server after attempting DB connection (connectDB logs errors but won't crash the process)
(async () => {
  await connectDB();
  const server = app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Stop the other server or run with PORT=${Number(port) + 1}.`
      );
      process.exit(1);
    }
    throw err;
  });
})();

