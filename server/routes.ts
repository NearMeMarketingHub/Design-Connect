import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
import type { User, InsertUser, InsertProject, InsertEstimate, InsertEstimateLineItem, InsertInvoice, InsertInvoiceLineItem, InsertRecurringBilling, InsertProjectPhase, InsertActionItem, InsertInspirationImage, InsertMessage } from "@shared/schema";

const PgSession = connectPgSimple(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Session setup
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "buildvision-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  // Passport setup
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsernameOrEmail(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username or email." });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { username, email, password, role, name } = req.body;
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role: role || "client",
        name,
      });

      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(400).json({ message: info?.message || "Login failed" });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as User;
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    }
    res.status(401).json({ message: "Not authenticated" });
  });

  // Project routes
  app.get("/api/projects", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      let projects;
      if (user.role === "client") {
        projects = await storage.getProjectsByClientId(user.id);
      } else {
        projects = await storage.getProjects();
      }
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res, next) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects", requireAuth, async (req, res, next) => {
    try {
      const project = await storage.createProject(req.body);
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/projects/:id", requireAuth, async (req, res, next) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  // Estimate routes
  app.get("/api/estimates", requireAuth, async (req, res, next) => {
    try {
      const estimates = await storage.getEstimates();
      res.json(estimates);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/estimates/:id", requireAuth, async (req, res, next) => {
    try {
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }
      const lineItems = await storage.getEstimateLineItems(req.params.id);
      res.json({ ...estimate, lineItems });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estimates", requireAuth, async (req, res, next) => {
    try {
      const { lineItems, ...estimateData } = req.body;
      const estimate = await storage.createEstimate(estimateData);
      
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createEstimateLineItem({
            ...item,
            estimateId: estimate.id,
          });
        }
      }
      
      res.json(estimate);
    } catch (error) {
      next(error);
    }
  });

  // Invoice routes
  app.get("/api/invoices", requireAuth, async (req, res, next) => {
    try {
      const invoices = await storage.getInvoices();
      res.json(invoices);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res, next) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const lineItems = await storage.getInvoiceLineItems(req.params.id);
      res.json({ ...invoice, lineItems });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/invoices", requireAuth, async (req, res, next) => {
    try {
      const { lineItems, ...invoiceData } = req.body;
      const invoice = await storage.createInvoice(invoiceData);
      
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createInvoiceLineItem({
            ...item,
            invoiceId: invoice.id,
          });
        }
      }
      
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  });

  // Recurring billing routes
  app.get("/api/recurring-billing", requireAuth, async (req, res, next) => {
    try {
      const billing = await storage.getRecurringBilling();
      res.json(billing);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/recurring-billing", requireAuth, async (req, res, next) => {
    try {
      const billing = await storage.createRecurringBilling(req.body);
      res.json(billing);
    } catch (error) {
      next(error);
    }
  });

  // Project phase routes
  app.get("/api/projects/:projectId/phases", requireAuth, async (req, res, next) => {
    try {
      const phases = await storage.getProjectPhases(req.params.projectId);
      res.json(phases);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/phases", requireAuth, async (req, res, next) => {
    try {
      const phase = await storage.createProjectPhase({
        ...req.body,
        projectId: req.params.projectId,
      });
      res.json(phase);
    } catch (error) {
      next(error);
    }
  });

  // Action item routes
  app.get("/api/projects/:projectId/action-items", requireAuth, async (req, res, next) => {
    try {
      const items = await storage.getActionItems(req.params.projectId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/action-items", requireAuth, async (req, res, next) => {
    try {
      const item = await storage.createActionItem({
        ...req.body,
        projectId: req.params.projectId,
      });
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/action-items/:id", requireAuth, async (req, res, next) => {
    try {
      const item = await storage.updateActionItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Action item not found" });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  // Inspiration image routes
  app.get("/api/projects/:projectId/inspiration", requireAuth, async (req, res, next) => {
    try {
      const images = await storage.getInspirationImages(req.params.projectId);
      res.json(images);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/inspiration", requireAuth, async (req, res, next) => {
    try {
      const image = await storage.createInspirationImage({
        ...req.body,
        projectId: req.params.projectId,
      });
      res.json(image);
    } catch (error) {
      next(error);
    }
  });

  // Message routes - allow without strict auth for demo
  app.get("/api/projects/:projectId/messages", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      const currentUserId = user?.id;
      const messages = await storage.getMessages(req.params.projectId);
      // Add isOwn flag to each message
      const messagesWithOwnership = messages.map(msg => ({
        ...msg,
        isOwn: currentUserId ? msg.senderId === currentUserId : msg.senderId === 'current-user'
      }));
      res.json(messagesWithOwnership);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/messages", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      const message = await storage.createMessage({
        ...req.body,
        projectId: req.params.projectId,
        senderId: user?.id || req.body.senderId || 'demo-user',
        senderName: user?.name || req.body.senderName || 'You',
        senderAvatar: req.body.senderAvatar || (user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'YO'),
      });
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
