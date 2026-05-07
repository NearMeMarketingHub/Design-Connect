import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";

// Global handlers to prevent server crashes from unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '100mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(
  express.raw({
    type: ['application/pdf', 'application/octet-stream', 'image/*'],
    limit: '100mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '100mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

async function runPasswordResetTokenCleanup() {
  try {
    const count = await storage.deleteExpiredPasswordResetTokens();
    if (count > 0) {
      log(`Cleaned up ${count} expired password reset token(s)`, "cleanup");
    }
  } catch (err) {
    console.error("Failed to clean up expired password reset tokens:", err);
  }
}

(async () => {
  await registerRoutes(httpServer, app);

  // Run once at startup, then every hour
  await runPasswordResetTokenCleanup();
  setInterval(runPasswordResetTokenCleanup, 60 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Express error:", err);

    if (res.headersSent) return;

    // Sanitize Postgres / database errors into user-friendly messages
    const pgCode = err.code || err.cause?.code;
    if (pgCode) {
      switch (pgCode) {
        case "23505": // unique_violation
          return res.status(409).json({ message: "A record with that value already exists. Please use a different value." });
        case "23503": // foreign_key_violation
          return res.status(400).json({ message: "This record is linked to other data and cannot be removed." });
        case "23502": // not_null_violation
          return res.status(400).json({ message: "A required field is missing. Please fill in all required fields." });
        case "23514": // check_violation
          return res.status(400).json({ message: "The provided value is not allowed. Please check your input." });
        case "42P01": // undefined_table
          return res.status(500).json({ message: "A database configuration error occurred. Please contact support." });
        case "ECONNREFUSED":
        case "08006":
        case "08001":
          return res.status(503).json({ message: "The database is temporarily unavailable. Please try again in a moment." });
      }
    }

    // Zod validation errors bubble up as-is with a specific shape
    if (err.name === "ZodError" && err.errors) {
      const first = err.errors[0];
      const message = first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
      return res.status(400).json({ message });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
