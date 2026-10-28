require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/auth");
const eventRoutes = require("./routes/events");
const registrationRoutes = require("./routes/registrations");

const app = express();
const port = Number(process.env.PORT) || 3000;
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "college-event-management-api" }));
app.use("/api/auth", authRoutes);
app.use("/api", registrationRoutes);
app.use("/api/events", eventRoutes);
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API endpoint not found." });
  return res.status(404).send("Page not found.");
});
app.use((error, req, res, _next) => {
  // Detailed errors belong in server logs only, never in the API response.
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, error.message);
  if (res.headersSent) return;
  return res.status(500).json({ error: "A server error occurred. Check the server terminal for details." });
});
app.listen(port, () => console.log(`CampusConnect running at http://localhost:${port}`));
