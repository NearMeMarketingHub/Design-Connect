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
      
      // Contractors need admin approval, clients are auto-approved
      const isApproved = role !== "contractor";
      
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role: role || "client",
        name,
        isApproved,
      });

      // If contractor, don't log them in - they need approval first
      if (role === "contractor") {
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ 
          user: userWithoutPassword, 
          pendingApproval: true,
          message: "Your account has been created and is pending admin approval."
        });
      }

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
    const { portal } = req.body; // 'client', 'contractor', or 'admin'
    
    passport.authenticate("local", (err: any, user: User, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(400).json({ message: info?.message || "Login failed" });
      }
      
      // Role-based portal access validation
      // Admins can access any portal
      if (user.role !== "admin") {
        // Clients can only use client portal
        if (user.role === "client" && portal !== "client") {
          return res.status(403).json({ 
            message: "Please use the Client Portal to log in." 
          });
        }
        // Contractors can only use contractor portal
        if (user.role === "contractor" && portal !== "contractor") {
          return res.status(403).json({ 
            message: "Please use the Contractor Portal to log in." 
          });
        }
      }
      
      // Check if contractor is approved
      if (user.role === "contractor" && !user.isApproved) {
        return res.status(403).json({ 
          message: "Your account is pending admin approval. Please wait for approval before logging in." 
        });
      }
      
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword, portal });
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

  // Admin-only middleware
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as User;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Admin contractor approval routes
  app.get("/api/admin/contractors/pending", requireAdmin, async (req, res, next) => {
    try {
      const contractors = await storage.getPendingContractors();
      const contractorsWithoutPasswords = contractors.map(({ password: _, ...user }) => user);
      res.json(contractorsWithoutPasswords);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/contractors/:id/approve", requireAdmin, async (req, res, next) => {
    try {
      const user = await storage.approveContractor(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "Contractor not found" });
      }
      res.json({ message: "Contractor approved successfully" });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/contractors/:id/reject", requireAdmin, async (req, res, next) => {
    try {
      await storage.rejectContractor(req.params.id);
      res.json({ message: "Contractor rejected and removed" });
    } catch (error) {
      next(error);
    }
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

  // Update message (edit)
  app.put("/api/messages/:messageId", async (req, res, next) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      const message = await storage.updateMessage(req.params.messageId, content);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // Delete message (soft delete)
  app.delete("/api/messages/:messageId", async (req, res, next) => {
    try {
      const message = await storage.deleteMessage(req.params.messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // Mark messages as read
  app.post("/api/projects/:projectId/messages/read", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      const userId = user?.id || 'demo-user';
      await storage.markProjectMessagesAsRead(req.params.projectId, userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Progress Post routes
  app.get("/api/projects/:projectId/posts", async (req, res, next) => {
    try {
      const posts = await storage.getProgressPosts(req.params.projectId);
      res.json(posts);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts/:postId", async (req, res, next) => {
    try {
      const post = await storage.getProgressPost(req.params.postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      res.json(post);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/posts", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      const post = await storage.createProgressPost({
        ...req.body,
        projectId: req.params.projectId,
        creatorId: user?.id || 'demo-contractor',
        creatorName: user?.name || req.body.creatorName || 'Contractor',
      });
      res.json(post);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/posts/:postId", async (req, res, next) => {
    try {
      await storage.deleteProgressPost(req.params.postId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Post Comment routes
  app.get("/api/posts/:postId/comments", async (req, res, next) => {
    try {
      const comments = await storage.getPostComments(req.params.postId);
      res.json(comments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:postId/comments", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      const comment = await storage.createPostComment({
        ...req.body,
        postId: req.params.postId,
        userId: user?.id || 'demo-user',
        userName: user?.name || req.body.userName || 'User',
        userAvatar: req.body.userAvatar || (user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'),
      });
      res.json(comment);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/comments/:commentId", async (req, res, next) => {
    try {
      await storage.deletePostComment(req.params.commentId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Admin project routes (requireAdmin middleware defined earlier)
  app.get("/api/admin/projects", requireAdmin, async (req, res, next) => {
    try {
      const projects = await storage.getAllProjectsWithDetails();
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/projects/:projectId", requireAdmin, async (req, res, next) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/contractors", requireAdmin, async (req, res, next) => {
    try {
      const contractors = await storage.getUsersByRole("contractor");
      res.json(contractors.map(c => ({ ...c, password: undefined })));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/clients", requireAdmin, async (req, res, next) => {
    try {
      const clients = await storage.getUsersByRole("client");
      res.json(clients.map(c => ({ ...c, password: undefined })));
    } catch (error) {
      next(error);
    }
  });

  // Get clients for project assignment (contractors can also use this)
  // Excludes sandbox clients by default
  app.get("/api/users/clients", requireAuth, async (req, res, next) => {
    try {
      const includeSandbox = req.query.includeSandbox === "true";
      const clients = await storage.getUsersByRole("client");
      const filteredClients = includeSandbox 
        ? clients 
        : clients.filter(c => !c.isSandbox);
      res.json(filteredClients.map(c => ({ id: c.id, name: c.name, username: c.username })));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/projects/:projectId/assign", requireAdmin, async (req, res, next) => {
    try {
      const { contractorId } = req.body;
      const updated = await storage.updateProject(req.params.projectId, { contractorId });
      if (!updated) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Sandbox routes - Admin testing environment
  app.get("/api/sandbox/data", requireAdmin, async (req, res, next) => {
    try {
      const data = await storage.getSandboxData();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sandbox/initialize", requireAdmin, async (req, res, next) => {
    try {
      const admin = req.user as User;
      const data = await storage.initializeSandbox(admin);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sandbox/reset", requireAdmin, async (req, res, next) => {
    try {
      const admin = req.user as User;
      await storage.resetSandbox();
      const data = await storage.initializeSandbox(admin);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  // Post Reaction routes
  app.get("/api/posts/:postId/reactions", async (req, res, next) => {
    try {
      const reactions = await storage.getPostReactions(req.params.postId);
      res.json(reactions);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/posts/:postId/reactions", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      const userId = user?.id || 'demo-user';
      const userName = user?.name || req.body.userName || 'User';
      
      // Check if user already reacted
      const existing = await storage.getPostReactionByUser(req.params.postId, userId);
      if (existing) {
        // Toggle off - remove reaction
        await storage.deletePostReaction(req.params.postId, userId);
        return res.json({ action: 'removed' });
      }
      
      // Add new reaction
      const reaction = await storage.createPostReaction({
        postId: req.params.postId,
        userId,
        userName,
        reactionType: req.body.reactionType || 'like',
      });
      res.json({ action: 'added', reaction });
    } catch (error) {
      next(error);
    }
  });

  // Budget Category routes - Admin only
  app.get("/api/budget/categories", requireAdmin, async (req, res, next) => {
    try {
      const categories = await storage.getBudgetCategories();
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/budget/categories/:id", requireAdmin, async (req, res, next) => {
    try {
      const category = await storage.getBudgetCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      const items = await storage.getBudgetItems(req.params.id);
      res.json({ ...category, items });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/budget/categories", requireAdmin, async (req, res, next) => {
    try {
      const category = await storage.createBudgetCategory(req.body);
      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/budget/categories/:id", requireAdmin, async (req, res, next) => {
    try {
      const category = await storage.updateBudgetCategory(req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/budget/categories/:id", requireAdmin, async (req, res, next) => {
    try {
      await storage.deleteBudgetCategory(req.params.id);
      res.json({ message: "Category deleted" });
    } catch (error) {
      next(error);
    }
  });

  // Budget Item routes - Admin only
  app.get("/api/budget/categories/:categoryId/items", requireAdmin, async (req, res, next) => {
    try {
      const items = await storage.getBudgetItems(req.params.categoryId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/budget/items", requireAdmin, async (req, res, next) => {
    try {
      const items = await storage.getAllBudgetItems();
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/budget/items/:id", requireAdmin, async (req, res, next) => {
    try {
      const item = await storage.getBudgetItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/budget/items", requireAdmin, async (req, res, next) => {
    try {
      const item = await storage.createBudgetItem(req.body);
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/budget/items/:id", requireAdmin, async (req, res, next) => {
    try {
      const item = await storage.updateBudgetItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/budget/items/:id", requireAdmin, async (req, res, next) => {
    try {
      await storage.deleteBudgetItem(req.params.id);
      res.json({ message: "Item deleted" });
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
