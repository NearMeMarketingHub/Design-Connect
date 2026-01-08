import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
import type { User, InsertUser, InsertProject, InsertEstimate, InsertEstimateLineItem, InsertInvoice, InsertInvoiceLineItem, InsertRecurringBilling, InsertProjectPhase, InsertActionItem, InsertInspirationImage, InsertMessage } from "@shared/schema";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";

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
      const { username, email, password, role, name, companyName, companyType, phone } = req.body;
      
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
        phone,
        companyName,
        companyType,
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
      
      // Include client info if clientId exists
      let client = null;
      if (project.clientId) {
        const clientUser = await storage.getUser(project.clientId);
        if (clientUser) {
          const { password: _, ...clientWithoutPassword } = clientUser;
          client = clientWithoutPassword;
        }
      }
      
      res.json({ ...project, client });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const project = await storage.createProject({
        ...req.body,
        contractorId: user.id,
      });
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

  app.patch("/api/phases/:id", requireAuth, async (req, res, next) => {
    try {
      const phase = await storage.updateProjectPhase(req.params.id, req.body);
      if (!phase) {
        return res.status(404).json({ message: "Phase not found" });
      }
      res.json(phase);
    } catch (error) {
      next(error);
    }
  });

  // Initialize phases for existing projects - accepts phases from frontend
  app.post("/api/projects/:projectId/phases/initialize", requireAuth, async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const { phases: phasesToCreate } = req.body;
      
      const existingPhases = await storage.getProjectPhases(projectId);
      
      if (existingPhases.length > 0) {
        return res.json(existingPhases);
      }
      
      if (!phasesToCreate || !Array.isArray(phasesToCreate)) {
        return res.status(400).json({ message: "phases array is required" });
      }
      
      const createdPhases = [];
      for (let i = 0; i < phasesToCreate.length; i++) {
        const phaseData = phasesToCreate[i];
        const phase = await storage.createProjectPhase({
          projectId,
          name: phaseData.name,
          status: "pending",
          dateRange: phaseData.date || "",
          tasks: phaseData.tasks || [],
          orderIndex: i,
        });
        createdPhases.push(phase);
      }
      
      res.json(createdPhases);
    } catch (error) {
      next(error);
    }
  });

  // Phase update routes
  app.get("/api/projects/:projectId/phase-updates", requireAuth, async (req, res, next) => {
    try {
      const updates = await storage.getProjectPhaseUpdates(req.params.projectId);
      res.json(updates);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/phases/:phaseId/updates", requireAuth, async (req, res, next) => {
    try {
      const updates = await storage.getPhaseUpdates(req.params.phaseId);
      res.json(updates);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/phases/:phaseId/updates", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const update = await storage.createPhaseUpdate({
        ...req.body,
        phaseId: req.params.phaseId,
        createdBy: user.id,
        createdByName: user.name || user.username,
      });
      res.json(update);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/phase-updates/:id", requireAuth, async (req, res, next) => {
    try {
      await storage.deletePhaseUpdate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Milestone task routes
  app.get("/api/projects/:projectId/milestone-tasks", requireAuth, async (req, res, next) => {
    try {
      const tasks = await storage.getProjectMilestoneTasks(req.params.projectId);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/phases/:phaseId/tasks", requireAuth, async (req, res, next) => {
    try {
      const tasks = await storage.getMilestoneTasks(req.params.phaseId);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/phases/:phaseId/tasks", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const task = await storage.createMilestoneTask({
        ...req.body,
        phaseId: req.params.phaseId,
        createdBy: user.id,
      });
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/milestone-tasks/:id", requireAuth, async (req, res, next) => {
    try {
      const task = await storage.updateMilestoneTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/milestone-tasks/:id", requireAuth, async (req, res, next) => {
    try {
      await storage.deleteMilestoneTask(req.params.id);
      res.json({ success: true });
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
  app.get("/api/projects/:projectId/inspiration", async (req, res, next) => {
    try {
      const images = await storage.getInspirationImages(req.params.projectId);
      res.json(images);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/inspiration", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      const image = await storage.createInspirationImage({
        ...req.body,
        projectId: req.params.projectId,
        creatorId: user?.id || req.body.creatorId || 'demo-user',
        creatorName: user?.name || req.body.creatorName || 'You',
      });
      res.json(image);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/inspiration/:imageId", async (req, res, next) => {
    try {
      await storage.deleteInspirationImage(req.params.imageId);
      res.json({ success: true });
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
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Only contractors and admins can create posts
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can create progress posts" });
      }
      
      const post = await storage.createProgressPost({
        ...req.body,
        projectId: req.params.projectId,
        creatorId: user.id,
        creatorName: user.name || 'Contractor',
      });
      res.json(post);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/posts/:postId", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Check post ownership - admins can delete any, contractors only their own
      const post = await storage.getProgressPost(req.params.postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      if (user.role !== 'admin' && post.creatorId !== user.id) {
        return res.status(403).json({ message: "You can only delete your own posts" });
      }
      
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
      const admins = await storage.getUsersByRole("admin");
      const allUsers = [...contractors, ...admins];
      res.json(allUsers.map(c => ({ ...c, password: undefined })));
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

  // Get clients and admins for project assignment (contractors can also use this)
  // Excludes sandbox clients by default
  app.get("/api/users/clients", requireAuth, async (req, res, next) => {
    try {
      const includeSandbox = req.query.includeSandbox === "true";
      const clients = await storage.getUsersByRole("client");
      const admins = await storage.getUsersByRole("admin");
      const allUsers = [...clients, ...admins];
      const filteredUsers = includeSandbox 
        ? allUsers 
        : allUsers.filter(u => !u.isSandbox);
      res.json(filteredUsers.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role })));
    } catch (error) {
      next(error);
    }
  });

  // Get approved contractors for team member selection
  app.get("/api/contractors", requireAuth, async (req, res, next) => {
    try {
      const contractors = await storage.getUsersByRole("contractor");
      const approvedContractors = contractors.filter(c => c.isApproved && !c.isSandbox);
      res.json(approvedContractors.map(c => ({ 
        id: c.id, 
        name: c.name, 
        username: c.username, 
        companyName: c.companyName,
        companyType: c.companyType
      })));
    } catch (error) {
      next(error);
    }
  });

  // Get project team members
  app.get("/api/projects/:id/team", requireAuth, async (req, res, next) => {
    try {
      const teamMembers = await storage.getProjectTeamMembers(req.params.id);
      res.json(teamMembers);
    } catch (error) {
      next(error);
    }
  });

  // Add team member to project
  app.post("/api/projects/:id/team", requireAuth, async (req, res, next) => {
    try {
      const { contractorId, role } = req.body;
      const teamMember = await storage.addProjectTeamMember({
        projectId: req.params.id,
        contractorId,
        role: role || null,
      });
      res.status(201).json(teamMember);
    } catch (error) {
      next(error);
    }
  });

  // Remove team member from project
  app.delete("/api/projects/:id/team/:memberId", requireAuth, async (req, res, next) => {
    try {
      await storage.removeProjectTeamMember(req.params.memberId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Create contractor invite
  app.post("/api/contractor-invites", requireAuth, async (req, res, next) => {
    try {
      const { email, companyName, companyType, projectId } = req.body;
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const invite = await storage.createContractorInvite({
        email,
        companyName: companyName || null,
        companyType: companyType || null,
        projectId: projectId || null,
        token,
        expiresAt,
        invitedBy: (req.user as User).id,
      });
      
      res.status(201).json(invite);
    } catch (error) {
      next(error);
    }
  });

  // Accept contractor invite
  app.post("/api/contractor-invites/:token/accept", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const invite = await storage.acceptContractorInvite(req.params.token, user.id);
      if (!invite) {
        return res.status(404).json({ message: "Invite not found or expired" });
      }
      res.json(invite);
    } catch (error) {
      next(error);
    }
  });

  // ==================== CHAT ROUTES ====================
  
  // Helper function to check if user is admin or project manager
  const isAdminOrProjectManager = (user: User): boolean => {
    return user.role === 'admin' || user.companyType === 'Project Manager';
  };

  // Get all chats for a project
  app.get("/api/projects/:projectId/chats", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const isAdminOrPM = isAdminOrProjectManager(user);
      const chats = await storage.getProjectChats(req.params.projectId, user.id, isAdminOrPM);
      res.json(chats);
    } catch (error) {
      next(error);
    }
  });

  // Create a new chat in a project
  app.post("/api/projects/:projectId/chats", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { participantIds, title, type } = req.body;
      
      // Create the chat
      const chat = await storage.createChat({
        projectId: req.params.projectId,
        type: type || (participantIds.length === 2 ? 'direct' : 'group'),
        title: title || null,
        createdById: user.id,
        isDefault: false,
        lastMessageAt: null,
        lastMessagePreview: null,
        lastMessageSenderId: null,
        lastMessageSenderName: null
      });
      
      // Add all participants including the creator
      for (const participantId of participantIds) {
        await storage.addChatParticipant({ chatId: chat.id, userId: participantId });
      }
      
      // Make sure creator is a participant
      const creatorIsParticipant = participantIds.includes(user.id);
      if (!creatorIsParticipant) {
        await storage.addChatParticipant({ chatId: chat.id, userId: user.id });
      }
      
      res.status(201).json(chat);
    } catch (error) {
      next(error);
    }
  });

  // Get messages for a specific chat
  app.get("/api/chats/:chatId/messages", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const isAdminOrPM = isAdminOrProjectManager(user);
      
      // Check if user can access this chat
      const chat = await storage.getChat(req.params.chatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      const isParticipant = await storage.isUserInChat(req.params.chatId, user.id);
      if (!isAdminOrPM && !isParticipant) {
        return res.status(403).json({ message: "You do not have access to this chat" });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before ? new Date(req.query.before as string) : undefined;
      
      const messages = await storage.getChatMessages(req.params.chatId, limit, before);
      res.json(messages);
    } catch (error) {
      next(error);
    }
  });

  // Send a message in a chat
  app.post("/api/chats/:chatId/messages", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      
      // Check if user is a participant
      const isParticipant = await storage.isUserInChat(req.params.chatId, user.id);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this chat" });
      }
      
      const chat = await storage.getChat(req.params.chatId);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      
      const { content, attachmentType, attachmentUrl, attachmentName, replyToImageUrl, replyToImageTitle } = req.body;
      
      const message = await storage.createChatMessage({
        chatId: req.params.chatId,
        projectId: chat.projectId,
        senderId: user.id,
        senderName: user.name || user.username,
        senderAvatar: user.profilePicture,
        content,
        attachmentType: attachmentType || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        replyToImageUrl: replyToImageUrl || null,
        replyToImageTitle: replyToImageTitle || null
      });
      
      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  });

  // Mark messages as read in a chat
  app.post("/api/chats/:chatId/read", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      
      // Check if user is a participant
      const isParticipant = await storage.isUserInChat(req.params.chatId, user.id);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this chat" });
      }
      
      await storage.markMessagesAsRead(req.params.chatId, user.id);
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Get read receipts for a chat (for the last message)
  app.get("/api/chats/:chatId/read-receipts", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const isAdminOrPM = isAdminOrProjectManager(user);
      
      // Check if user can access this chat
      const isParticipant = await storage.isUserInChat(req.params.chatId, user.id);
      if (!isAdminOrPM && !isParticipant) {
        return res.status(403).json({ message: "You do not have access to this chat" });
      }
      
      const reads = await storage.getChatMessageReads(req.params.chatId);
      res.json(reads);
    } catch (error) {
      next(error);
    }
  });

  // Get participants of a chat
  app.get("/api/chats/:chatId/participants", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const isAdminOrPM = isAdminOrProjectManager(user);
      
      // Check if user can access this chat
      const isParticipant = await storage.isUserInChat(req.params.chatId, user.id);
      if (!isAdminOrPM && !isParticipant) {
        return res.status(403).json({ message: "You do not have access to this chat" });
      }
      
      const participants = await storage.getChatParticipants(req.params.chatId);
      res.json(participants);
    } catch (error) {
      next(error);
    }
  });

  // Add participant to a chat
  app.post("/api/chats/:chatId/participants", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { userId } = req.body;
      
      // Only participants can add others
      const isParticipant = await storage.isUserInChat(req.params.chatId, user.id);
      if (!isParticipant) {
        return res.status(403).json({ message: "You are not a participant in this chat" });
      }
      
      // Check if already a participant
      const alreadyParticipant = await storage.isUserInChat(req.params.chatId, userId);
      if (alreadyParticipant) {
        return res.status(400).json({ message: "User is already a participant" });
      }
      
      const participant = await storage.addChatParticipant({ chatId: req.params.chatId, userId });
      res.status(201).json(participant);
    } catch (error) {
      next(error);
    }
  });

  // Create default chats for a project (called after team members are added)
  app.post("/api/projects/:projectId/create-default-chats", requireAuth, async (req, res, next) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Get team members with their details
      const teamMembersRaw = await storage.getProjectTeamMembers(req.params.projectId);
      const teamMembers = teamMembersRaw.map(m => ({
        contractorId: m.contractorId,
        role: m.role,
        name: m.contractor?.name || m.contractor?.username || 'Team Member',
        companyName: m.contractor?.companyName || null
      }));
      
      await storage.createDefaultChatsForProject(
        req.params.projectId,
        project.clientId,
        teamMembers
      );
      
      res.json({ success: true, message: "Default chats created" });
    } catch (error) {
      next(error);
    }
  });

  // ==================== END CHAT ROUTES ====================

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

  // Migration endpoint to convert existing project IDs to slug format
  app.post("/api/admin/migrate-project-ids", requireAdmin, async (req, res, next) => {
    try {
      const result = await storage.migrateProjectIdsToSlug();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Backfill default chats for all existing projects that don't have them
  app.post("/api/admin/backfill-default-chats", requireAdmin, async (req, res, next) => {
    try {
      const projects = await storage.getProjects();
      const results = { processed: 0, skipped: 0, created: 0, errors: [] as string[] };
      
      for (const project of projects) {
        results.processed++;
        
        // Skip projects without clients
        if (!project.clientId) {
          results.skipped++;
          continue;
        }
        
        // Check if project already has default chats
        const existingChats = await storage.getProjectChats(project.id, project.clientId, true);
        const hasDefaultChats = existingChats.some(chat => chat.isDefault);
        
        if (hasDefaultChats) {
          results.skipped++;
          continue;
        }
        
        // Get team members for the project
        const teamMembers = await storage.getProjectTeamMembers(project.id);
        
        if (teamMembers.length === 0) {
          results.skipped++;
          continue;
        }
        
        try {
          await storage.createDefaultChatsForProject(
            project.id,
            project.clientId,
            teamMembers.map(m => ({
              contractorId: m.contractorId,
              role: m.role,
              name: m.contractor?.name || 'Contractor',
              companyName: m.contractor?.companyName || null,
            }))
          );
          results.created++;
        } catch (err: any) {
          results.errors.push(`Project ${project.id}: ${err.message}`);
        }
      }
      
      res.json({
        message: "Backfill complete",
        ...results
      });
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

  // Contractor Calculator routes - Read-only access for contractors/admins
  const requireContractorOrAdmin = (req: any, res: any, next: any) => {
    const user = req.user as User | undefined;
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (user.role !== 'contractor' && user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied" });
    }
    // Contractors must be approved
    if (user.role === 'contractor' && !user.isApproved) {
      return res.status(403).json({ message: "Your account is pending approval" });
    }
    next();
  };

  app.get("/api/calculator/categories", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const categories = await storage.getBudgetCategories();
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/calculator/categories/:id/items", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const items = await storage.getBudgetItems(req.params.id);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/calculator/items", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const items = await storage.getAllBudgetItems();
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/calculator/items/search", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const query = (req.query.q as string) || '';
      const items = await storage.getAllBudgetItems();
      // Filter items by search query
      const filtered = items.filter((item: any) => 
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.itemType.toLowerCase().includes(query.toLowerCase())
      );
      res.json(filtered);
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

  // Project Invite routes
  const crypto = await import("crypto");
  const { sendProjectInviteEmail } = await import("./email");

  // Create invite and send email
  app.post("/api/projects/:projectId/invite", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { email, clientName } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Generate unique token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invite record
      const invite = await storage.createProjectInvite({
        projectId: req.params.projectId,
        email,
        token,
        clientName,
        status: "pending",
        invitedBy: user.id,
        expiresAt,
      });

      // Send invite email
      try {
        await sendProjectInviteEmail(email, {
          projectName: project.name,
          contractorName: user.name || user.username,
          inviteToken: token,
          clientName,
        });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Still return success - invite was created
      }

      res.json({ message: "Invitation sent successfully", invite: { id: invite.id, email, status: invite.status } });
    } catch (error) {
      next(error);
    }
  });

  // Get invites for a project
  app.get("/api/projects/:projectId/invites", requireAuth, async (req, res, next) => {
    try {
      const invites = await storage.getProjectInvitesByProjectId(req.params.projectId);
      res.json(invites);
    } catch (error) {
      next(error);
    }
  });

  // Get invite by token (public - for accepting invites)
  app.get("/api/invites/:token", async (req, res, next) => {
    try {
      const invite = await storage.getProjectInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: "Invalid or expired invitation" });
      }

      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "This invitation has expired" });
      }

      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This invitation has already been used" });
      }

      // Get project info
      const project = invite.projectId ? await storage.getProject(invite.projectId) : null;

      res.json({
        email: invite.email,
        clientName: invite.clientName,
        projectName: project?.name,
        projectId: invite.projectId,
      });
    } catch (error) {
      next(error);
    }
  });

  // Accept invite and create account
  app.post("/api/invites/:token/accept", async (req, res, next) => {
    try {
      const { username, password, name } = req.body;

      const invite = await storage.getProjectInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: "Invalid invitation" });
      }

      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "This invitation has expired" });
      }

      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This invitation has already been used" });
      }

      // Check if username exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Create new client account
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        username,
        email: invite.email,
        password: hashedPassword,
        role: "client",
        name: name || invite.clientName,
        isApproved: true,
      });

      // Update invite as accepted
      await storage.acceptProjectInvite(req.params.token, newUser.id);

      // Assign user to project
      if (invite.projectId) {
        await storage.updateProject(invite.projectId, { clientId: newUser.id });
      }

      // Log user in
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = newUser;
        return res.json({ user: userWithoutPassword, message: "Account created successfully" });
      });
    } catch (error) {
      next(error);
    }
  });

  // Contractor access request routes
  app.post("/api/contractor-requests", async (req, res, next) => {
    try {
      const { firstName, lastName, username, companyName, companyType, email } = req.body;
      
      if (!firstName || !lastName || !username || !companyName || !companyType) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const request = await storage.createContractorRequest({
        firstName,
        lastName,
        username,
        companyName,
        companyType,
        email: email || null,
        status: "pending"
      });

      res.status(201).json({ 
        message: "Your request has been submitted successfully. You will receive a response shortly.",
        request 
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/contractor-requests", requireAdmin, async (req, res, next) => {
    try {
      const requests = await storage.getContractorRequests();
      res.json(requests);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/contractor-requests/pending", requireAdmin, async (req, res, next) => {
    try {
      const requests = await storage.getPendingContractorRequests();
      res.json(requests);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/contractor-requests/:id/approve", requireAdmin, async (req, res, next) => {
    try {
      const request = await storage.getContractorRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create the contractor account
      const newUser = await storage.createUser({
        username: request.username,
        email: request.email || undefined,
        password: hashedPassword,
        role: "contractor",
        name: `${request.firstName} ${request.lastName}`,
        companyName: request.companyName,
        companyType: request.companyType,
        isApproved: true,
      });

      // Update request status
      await storage.updateContractorRequest(req.params.id, {
        status: "approved",
        reviewedAt: new Date(),
        reviewedBy: (req.user as User).id
      });

      res.json({ 
        message: "Contractor approved successfully",
        user: { ...newUser, password: undefined },
        tempPassword // In production, this would be sent via email
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/contractor-requests/:id/reject", requireAdmin, async (req, res, next) => {
    try {
      const request = await storage.getContractorRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      await storage.updateContractorRequest(req.params.id, {
        status: "rejected",
        reviewedAt: new Date(),
        reviewedBy: (req.user as User).id
      });

      res.json({ message: "Request rejected" });
    } catch (error) {
      next(error);
    }
  });

  // Project team member routes
  app.get("/api/projects/:projectId/team", requireAuth, async (req, res, next) => {
    try {
      const members = await storage.getProjectTeamMembers(req.params.projectId);
      res.json(members);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/team", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors and admins can add team members" });
      }
      
      const { contractorId, role } = req.body;
      if (!contractorId) {
        return res.status(400).json({ message: "Contractor ID is required" });
      }
      
      const member = await storage.addProjectTeamMember({
        projectId: req.params.projectId,
        contractorId,
        role,
        addedBy: user.id
      });
      
      res.json(member);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/projects/:projectId/team/:memberId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors and admins can remove team members" });
      }
      
      await storage.removeProjectTeamMember(req.params.memberId);
      res.json({ message: "Team member removed" });
    } catch (error) {
      next(error);
    }
  });

  // Get all contractors for team member selection
  app.get("/api/contractors", requireAuth, async (req, res, next) => {
    try {
      const contractors = await storage.getUsersByRole('contractor');
      // Only return approved contractors, exclude passwords
      const approvedContractors = contractors
        .filter(c => c.isApproved)
        .map(({ password, ...contractor }) => contractor);
      res.json(approvedContractors);
    } catch (error) {
      next(error);
    }
  });

  // Contractor invite routes (for inviting new contractors to join platform)
  app.post("/api/contractor-invites", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors and admins can invite contractors" });
      }
      
      const { email, companyName, companyType, projectId } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Check if contractor already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      
      // Generate invite token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const invite = await storage.createContractorInvite({
        email,
        companyName,
        companyType,
        projectId: projectId || null,
        token,
        invitedBy: user.id,
        expiresAt,
        status: 'pending'
      });
      
      res.json(invite);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/contractor-invites/project/:projectId", requireAuth, async (req, res, next) => {
    try {
      const invites = await storage.getContractorInvitesByProject(req.params.projectId);
      res.json(invites);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/contractor-invites/token/:token", async (req, res, next) => {
    try {
      const invite = await storage.getContractorInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }
      if (invite.status !== 'pending') {
        return res.status(400).json({ message: "Invite has already been used or expired" });
      }
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invite has expired" });
      }
      
      // Get project info if invite is for a project
      const project = invite.projectId ? await storage.getProject(invite.projectId) : null;
      
      res.json({
        email: invite.email,
        companyName: invite.companyName,
        companyType: invite.companyType,
        projectId: invite.projectId,
        projectName: project?.name
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/contractor-invites/accept/:token", async (req, res, next) => {
    try {
      const invite = await storage.getContractorInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }
      if (invite.status !== 'pending') {
        return res.status(400).json({ message: "Invite has already been used" });
      }
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invite has expired" });
      }
      
      const { username, password, firstName, lastName } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }
      
      // Create the contractor account
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        email: invite.email,
        name: firstName && lastName ? `${firstName} ${lastName}` : undefined,
        role: 'contractor',
        companyName: invite.companyName,
        companyType: invite.companyType,
        isApproved: true // Auto-approved since they were invited
      });
      
      // Accept the invite (this also adds them to the project team if applicable)
      await storage.acceptContractorInvite(req.params.token, newUser.id);
      
      res.json({ 
        message: "Account created successfully",
        user: { ...newUser, password: undefined }
      });
    } catch (error) {
      next(error);
    }
  });

  // Register object storage routes
  registerObjectStorageRoutes(app);

  // Update user profile picture
  app.post("/api/user/profile-picture", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = req.user as User;
      const { objectPath } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ error: "Object path required" });
      }

      // Set the ACL policy to make the profile picture public
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(
        objectPath,
        { owner: user.id, visibility: "public" }
      );

      // Update user's profile picture in database
      await storage.updateUser(user.id, { profilePicture: normalizedPath });

      res.json({ success: true, profilePicture: normalizedPath });
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
