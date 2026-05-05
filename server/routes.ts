import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
import type { User, InsertUser, InsertProject, InsertEstimate, InsertEstimateLineItem, InsertInvoice, InsertInvoiceLineItem, InsertRecurringBilling, InsertProjectPhase, InsertActionItem, InsertInspirationImage, InsertMessage, ExternalMemberPermissions } from "@shared/schema";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { createProjectBackup, shouldTriggerBackup } from "./backup-service";
import { runRoleMigration } from "./migrate-roles";
import { seedTestAccounts } from "./seed-test-accounts";
import { setupWebSocket, broadcast } from "./websocket";

const PgSession = connectPgSimple(session);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Attach WebSocket server for real-time updates
  setupWebSocket(httpServer);

  // Run idempotent role migration on startup
  runRoleMigration().catch(err => console.error("[migrate-roles] Migration error:", err));

  // Ensure test accounts (testsubcontractor etc.) are provisioned on startup.
  // Only runs in development/test environments — never in production.
  if (process.env.NODE_ENV !== "production") {
    seedTestAccounts().catch(err => console.error("[seed-test-accounts] Error:", err));
  }

  // Helper: get broadcast scoping context for a project.
  // Always resolves the project contractor's companyId so that client-triggered
  // events (e.g. change order approve) correctly reach contractor company users.
  async function getProjectBroadcastContext(projectId: string, _actingUserCompanyId?: string | null) {
    try {
      const project = await storage.getProject(projectId);
      const members = await storage.getProjectTeamMembers(projectId).catch(() => []);

      // Derive companyId from the project's primary contractor so the correct
      // company receives the event regardless of which user triggered it.
      let contractorCompanyId: string | null = null;
      if (project?.contractorId) {
        const contractor = await storage.getUser(project.contractorId).catch(() => null);
        contractorCompanyId = contractor?.companyId ?? null;
      }

      return {
        companyId: contractorCompanyId,
        clientUserId: project?.clientId ?? null,
        allowedUserIds: members.map((m) => m.contractorId).filter(Boolean) as string[],
      };
    } catch {
      return { companyId: null, clientUserId: null, allowedUserIds: [] };
    }
  }

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
      const { username, email, password, role, name, companyName, companyType, phone, contractorType } = req.body;
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // ── Public registration allowlist ────────────────────────────────────────
      // Only two roles may be created through public self-signup:
      //   1. "client"        — always allowed, auto-approved
      //   2. "contractor"    — only with contractorType in {subcontractor, notary}
      //
      // All other roles (company_owner, admin, plain contractor without subtype)
      // are blocked. company_owner accounts are created by admins after a demo.
      // Reject anything not explicitly in this allowlist — never trust raw role values.
      const ALLOWED_PUBLIC_ROLES = ["client", "contractor"] as const;
      const ALLOWED_CONTRACTOR_SUBTYPES = ["subcontractor", "notary"] as const;

      if (!ALLOWED_PUBLIC_ROLES.includes(role as any)) {
        return res.status(400).json({
          message: "Company accounts are created through our onboarding process. Please request a demo to get started.",
        });
      }
      const hasContractorSubtype =
        role === "contractor" &&
        ALLOWED_CONTRACTOR_SUBTYPES.includes(contractorType as any);
      if (role === "contractor" && !hasContractorSubtype) {
        return res.status(400).json({
          message: "Company accounts are created through our onboarding process. Please request a demo to get started.",
        });
      }

      // Derive the stored role from validated inputs only — never copy raw role for privileged types
      const mappedRole: string = hasContractorSubtype ? "contractor" : "client";
      // Contractor subtypes need admin approval; clients are auto-approved
      const isApproved = mappedRole === "client";
      
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role: mappedRole,
        name,
        phone,
        companyName,
        companyType,
        contractorType: hasContractorSubtype ? contractorType : null,
        isApproved,
      });

      // If company_owner, auto-create their company
      if (mappedRole === "company_owner") {
        const company = await storage.createCompany({
          name: companyName || `${name || username}'s Company`,
          ownerId: user.id,
          subscriptionPlan: "free",
          subscriptionStatus: "trialing",
          trialStartedAt: new Date(),
        });
        await storage.updateUser(user.id, { companyId: company.id });
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ 
          user: userWithoutPassword, 
          pendingApproval: true,
          message: "Your account has been created and is pending admin approval."
        });
      }
      
      // Contractor subtypes (notary, subcontractor) also need approval
      if (mappedRole === "contractor" && hasContractorSubtype) {
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
      
      // Contractor portal roles: company_owner, contractor (any subtype)
      const isContractorPortalRole = (role: string) =>
        role === "company_owner" || role === "contractor";

      // Role-based portal access validation
      // Admins can access any portal
      if (user.role !== "admin") {
        // Clients can only use client portal
        if (user.role === "client" && portal !== "client") {
          return res.status(403).json({ 
            message: "Please use the Client Portal to log in." 
          });
        }
        // Company owners and contractors use contractor portal
        if (isContractorPortalRole(user.role) && portal !== "contractor") {
          return res.status(403).json({ 
            message: "Please use the Contractor Portal to log in." 
          });
        }
        // Clients shouldn't hit contractor portal
        if (user.role === "client" && portal === "contractor") {
          return res.status(403).json({ 
            message: "Please use the Client Portal to log in." 
          });
        }
      }
      
      // Check if company_owner or contractor is approved
      if (isContractorPortalRole(user.role) && !user.isApproved) {
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
  const TRIAL_DAYS = 7;

  const requireActiveSubscription = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return next();
    const user = req.user as any;
    if (!user) return next();
    // Admins and clients are never blocked
    if (user.role === "admin" || user.role === "client") return next();
    // Subcontractors and notaries span companies — not subject to single-company billing
    if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) return next();
    const companyId = user.companyId;
    if (!companyId) return next();
    const company = await storage.getCompany(companyId);
    if (!company) return next();
    // Active paid subscription — always allowed
    if (company.subscriptionStatus === "active") return next();
    // Still within trial window — allowed
    if (company.subscriptionStatus === "trialing" && company.trialStartedAt) {
      const trialEnd = new Date(company.trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      if (new Date() <= trialEnd) return next();
    }
    // Expired or any other non-active status
    return res.status(402).json({
      message: "Your trial has expired. Please upgrade your subscription to continue.",
      code: "SUBSCRIPTION_REQUIRED",
    });
  };

  // Global middleware: enforce active subscription for all write operations
  // Allowlist: auth, admin (guarded by requireAdmin), subscription info, signing, invite acceptance
  app.use((req: any, res: any, next: any) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const path = req.path;
    if (
      path.startsWith("/api/auth") ||
      path.startsWith("/api/admin") ||
      path.startsWith("/api/subscription") ||
      path === "/api/company/mine" ||
      path.startsWith("/api/signing") ||
      path.startsWith("/api/sign/") ||
      // Only allow public invite acceptance (not invite creation which is a paid feature)
      path.startsWith("/api/contractor-invites/accept/") ||
      path.startsWith("/api/invites/") ||
      path.startsWith("/api/sandbox")
    ) {
      return next();
    }
    return requireActiveSubscription(req, res, next);
  });

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

  // Company owner middleware (also allows isCompanyAdmin contractors and admins)
  const requireCompanyOwner = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as User;
    const isCompanyManager = user.role === "company_owner" || user.isCompanyAdmin === true;
    if (!isCompanyManager && user.role !== "admin") {
      return res.status(403).json({ message: "Company owner access required" });
    }
    next();
  };

  // Helper: verify caller is owner/admin of the target company
  const verifyCompanyAccess = async (req: any, res: any, companyId: string): Promise<boolean> => {
    const user = req.user as User;
    if (user.role === "admin") return true;
    const company = await storage.getCompany(companyId);
    if (!company) { res.status(404).json({ message: "Company not found" }); return false; }
    const isOwner = user.role === "company_owner" && user.companyId === companyId;
    const isCompanyAdmin = user.isCompanyAdmin === true && user.companyId === companyId;
    if (!isOwner && !isCompanyAdmin) {
      res.status(403).json({ message: "You do not have access to this company" });
      return false;
    }
    return true;
  };

  // Contractor or company_owner middleware (any portal user)
  const requireContractorOrOwner = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as User;
    if (user.role !== "company_owner" && user.role !== "contractor" && user.role !== "admin") {
      return res.status(403).json({ message: "Contractor access required" });
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

  // ── Company routes ──────────────────────────────────────────────────────────

  // Get current user's company (works for company_owner AND company admins)
  app.get("/api/company/mine", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!user.companyId) return res.status(404).json({ message: "No company found" });
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "No company found" });
      res.json(company);
    } catch (error) { next(error); }
  });

  // Update current user's company (owner or company admin only)
  app.patch("/api/company/mine", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!user.companyId) return res.status(404).json({ message: "No company found" });
      if (user.role !== "company_owner" && user.role !== "admin" && user.isCompanyAdmin !== true) {
        return res.status(403).json({ message: "Only company owners and admins can update company settings" });
      }
      const updated = await storage.updateCompany(user.companyId, req.body);
      res.json(updated);
    } catch (error) { next(error); }
  });

  // Get company members (only owner, company admin, or platform admin)
  app.get("/api/company/:companyId/members", requireAuth, async (req, res, next) => {
    try {
      const ok = await verifyCompanyAccess(req, res, req.params.companyId);
      if (!ok) return;
      const members = await storage.getCompanyMembers(req.params.companyId);
      const membersWithoutPasswords = members.map(m => ({
        ...m,
        user: m.user ? (() => { const { password: _, ...u } = m.user!; return u; })() : undefined,
      }));
      res.json(membersWithoutPasswords);
    } catch (error) { next(error); }
  });

  // Add company member (owner or company admin of that company only)
  app.post("/api/company/:companyId/members", requireAuth, async (req, res, next) => {
    try {
      const ok = await verifyCompanyAccess(req, res, req.params.companyId);
      if (!ok) return;
      const member = await storage.addCompanyMember({
        companyId: req.params.companyId,
        userId: req.body.userId,
        status: "active",
      });
      res.json(member);
    } catch (error) { next(error); }
  });

  // Remove company member (owner or company admin of that company only)
  app.delete("/api/company/:companyId/members/:userId", requireAuth, async (req, res, next) => {
    try {
      const ok = await verifyCompanyAccess(req, res, req.params.companyId);
      if (!ok) return;
      await storage.removeCompanyMember(req.params.companyId, req.params.userId);
      res.json({ message: "Member removed" });
    } catch (error) { next(error); }
  });

  // Assign/update role template for a company member
  app.patch("/api/company/:companyId/members/:userId/role", requireAuth, async (req, res, next) => {
    try {
      const ok = await verifyCompanyAccess(req, res, req.params.companyId);
      if (!ok) return;
      const { roleDefinitionId } = req.body;
      // Allow null to clear assignment; validate if a value is provided
      if (roleDefinitionId) {
        const roleDef = await storage.getContractorRoleDefinition(roleDefinitionId);
        if (!roleDef) return res.status(404).json({ message: "Role definition not found" });
      }
      const updated = await storage.updateCompanyMember(req.params.companyId, req.params.userId, {
        roleDefinitionId: roleDefinitionId || null,
      });
      if (!updated) return res.status(404).json({ message: "Member not found" });
      res.json(updated);
    } catch (error) { next(error); }
  });

  // Toggle isCompanyAdmin for a company member (owner only, not self)
  app.patch("/api/company/:companyId/members/:userId/admin", requireAuth, async (req, res, next) => {
    try {
      const ok = await verifyCompanyAccess(req, res, req.params.companyId);
      if (!ok) return;
      const caller = req.user as User;
      if (caller.id === req.params.userId) {
        return res.status(400).json({ message: "Cannot change your own admin status" });
      }
      // Validate target user is actually a member of this company (prevent privilege escalation)
      const targetMembership = await storage.getCompanyMember(req.params.companyId, req.params.userId);
      if (!targetMembership) {
        return res.status(404).json({ message: "User is not a member of this company" });
      }
      const { isCompanyAdmin } = req.body;
      if (typeof isCompanyAdmin !== "boolean") {
        return res.status(400).json({ message: "isCompanyAdmin must be a boolean" });
      }
      await storage.updateUser(req.params.userId, { isCompanyAdmin });
      res.json({ message: "Admin status updated" });
    } catch (error) { next(error); }
  });

  // Admin: list all companies with owner and member count
  app.get("/api/admin/companies", requireAdmin, async (req, res, next) => {
    try {
      const companies = await storage.getAllCompanies();
      const enriched = await Promise.all(companies.map(async (company) => {
        const members = await storage.getCompanyMembers(company.id);
        const owner = await storage.getUserByCompanyOwner(company.id);
        return {
          ...company,
          memberCount: members.length,
          ownerName: owner ? (owner.name || owner.username) : null,
        };
      }));
      res.json(enriched);
    } catch (error) { next(error); }
  });

  // ── Admin: Update company subscription ───────────────────────────────────────
  const VALID_SUBSCRIPTION_STATUSES = ["trialing", "active", "expired", "past_due", "cancelled"] as const;

  const adminCompanySubscriptionSchema = z.object({
    // Plan name is open-ended — matches any admin-defined tier or legacy "free"
    subscriptionPlan: z.string().min(1).max(100).optional(),
    subscriptionStatus: z.enum(VALID_SUBSCRIPTION_STATUSES).optional(),
    trialStartedAt: z.string().datetime({ offset: true }).nullable().optional(),
  });

  app.patch("/api/admin/companies/:id/subscription", requireAdmin, async (req, res, next) => {
    try {
      const parsed = adminCompanySubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid subscription data", errors: parsed.error.flatten().fieldErrors });
      }
      const { subscriptionPlan, subscriptionStatus, trialStartedAt } = parsed.data;
      const updateData: any = {};
      if (subscriptionPlan !== undefined) updateData.subscriptionPlan = subscriptionPlan;
      if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
      if (trialStartedAt !== undefined) {
        updateData.trialStartedAt = trialStartedAt ? new Date(trialStartedAt) : null;
      } else if (subscriptionStatus === "trialing") {
        // Auto-reset trial start to now so the 7-day window starts fresh
        updateData.trialStartedAt = new Date();
      }
      const company = await storage.updateCompany(req.params.id, updateData);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
    } catch (error) { next(error); }
  });

  // ── Subscription tier routes ──────────────────────────────────────────────────
  // GET active tiers — for company dashboard (any authenticated user)
  app.get("/api/subscription/tiers", requireAuth, async (req, res, next) => {
    try {
      const tiers = await storage.getActiveSubscriptionTiers();
      res.json(tiers);
    } catch (error) { next(error); }
  });

  // Admin CRUD for subscription tiers
  app.get("/api/admin/subscription/tiers", requireAdmin, async (req, res, next) => {
    try {
      const tiers = await storage.getSubscriptionTiers();
      res.json(tiers);
    } catch (error) { next(error); }
  });

  const tierSchema = z.object({
    name: z.string().min(1).max(100),
    // Accept numeric string from forms or number from API calls
    price: z.coerce.number().nonnegative(),
    maxProjects: z.coerce.number().int().positive().nullable().optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
  });

  // ── Write-route validation schemas ─────────────────────────────────────────
  // Schemas for key POST/PATCH routes — catch bad data before it reaches the DB

  const createProjectSchema = z.object({
    name: z.string().min(1, "name is required"),
    address: z.string().min(1, "address is required"),
    status: z.string().min(1, "status is required"),
    phase: z.string().min(1, "phase is required"),
    progress: z.number().int().min(0).max(100).optional(),
    budgetStatus: z.string().optional().nullable(),
    nextMilestone: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    budget: z.union([z.string(), z.number()]).optional().nullable(),
    clientId: z.string().optional().nullable(),
    isSandbox: z.boolean().optional().nullable(),
  });
  const updateProjectSchema = createProjectSchema.partial();

  const createEstimateSchema = z.object({
    customId: z.string().min(1, "customId is required"),
    clientName: z.string().min(1, "clientName is required"),
    projectName: z.string().min(1, "projectName is required"),
    amount: z.string().min(1, "amount is required"),
    status: z.string().min(1, "status is required"),
    date: z.string().min(1, "date is required"),
    projectId: z.string().optional().nullable(),
    lineItems: z.array(z.any()).optional(),
  });

  const createInvoiceSchema = z.object({
    customId: z.string().min(1, "customId is required"),
    clientName: z.string().min(1, "clientName is required"),
    projectName: z.string().min(1, "projectName is required"),
    amount: z.string().min(1, "amount is required"),
    dueDate: z.string().min(1, "dueDate is required"),
    status: z.string().min(1, "status is required"),
    type: z.string().min(1, "type is required"),
    projectId: z.string().optional().nullable(),
    lineItems: z.array(z.any()).optional(),
  });

  const createRecurringBillingSchema = z.object({
    customId: z.string().min(1, "customId is required"),
    clientName: z.string().min(1, "clientName is required"),
    projectName: z.string().min(1, "projectName is required"),
    amount: z.string().min(1, "amount is required"),
    frequency: z.string().min(1, "frequency is required"),
    nextRunDate: z.string().min(1, "nextRunDate is required"),
    status: z.string().min(1, "status is required"),
    projectId: z.string().optional().nullable(),
  });

  const createPhaseSchema = z.object({
    name: z.string().min(1, "name is required"),
    status: z.string().min(1, "status is required"),
    dateRange: z.string(),
    tasks: z.array(z.string()),
    orderIndex: z.number().int().optional(),
    dueDate: z.string().optional().nullable(),
  });

  const createActionItemSchema = z.object({
    title: z.string().min(1, "title is required"),
    status: z.string().min(1, "status is required"),
    assignedTo: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
  });

  const projectInviteSchema = z.object({
    email: z.string().email("email must be a valid email address"),
    clientName: z.string().optional().nullable(),
  });

  const externalInviteSchema = z.object({
    email: z.string().email("email must be a valid email address"),
    name: z.string().optional().nullable(),
    role: z.enum(["subcontractor", "notary"]).optional(),
    permissions: z.record(z.boolean()).optional(),
  });

  const createChangeOrderSchema = z.object({
    title: z.string().min(1, "title is required"),
    description: z.string().default(""),
    reason: z.string().default(""),
    costImpact: z.union([z.string(), z.number()]).optional().nullable(),
    timelineImpact: z.coerce.number().int().optional().nullable(),
    lineItems: z.array(z.any()).optional(),
  });
  // ───────────────────────────────────────────────────────────────────────────

  app.post("/api/admin/subscription/tiers", requireAdmin, async (req, res, next) => {
    try {
      const parsed = tierSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid tier data", errors: parsed.error.flatten().fieldErrors });
      }
      // Drizzle numeric column expects string; convert coerced number back
      const tierData = { ...parsed.data, price: String(parsed.data.price) } as any;
      const tier = await storage.createSubscriptionTier(tierData);
      res.json(tier);
    } catch (error) { next(error); }
  });

  app.patch("/api/admin/subscription/tiers/:id", requireAdmin, async (req, res, next) => {
    try {
      const parsed = tierSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid tier data", errors: parsed.error.flatten().fieldErrors });
      }
      const updateData: any = { ...parsed.data };
      if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
      const tier = await storage.updateSubscriptionTier(req.params.id, updateData);
      if (!tier) return res.status(404).json({ message: "Tier not found" });
      res.json(tier);
    } catch (error) { next(error); }
  });

  app.delete("/api/admin/subscription/tiers/:id", requireAdmin, async (req, res, next) => {
    try {
      await storage.deleteSubscriptionTier(req.params.id);
      res.json({ message: "Tier deleted" });
    } catch (error) { next(error); }
  });

  // ── Contractor Role Definition routes (admin only) ───────────────────────────

  app.get("/api/admin/role-definitions", requireAdmin, async (req, res, next) => {
    try {
      const defs = await storage.getContractorRoleDefinitions();
      res.json(defs);
    } catch (error) { next(error); }
  });

  // Also expose to authenticated company owners for reading
  app.get("/api/role-definitions", requireAuth, async (req, res, next) => {
    try {
      const defs = await storage.getContractorRoleDefinitions();
      res.json(defs);
    } catch (error) { next(error); }
  });

  app.post("/api/admin/role-definitions", requireAdmin, async (req, res, next) => {
    try {
      const def = await storage.createContractorRoleDefinition(req.body);
      res.json(def);
    } catch (error) { next(error); }
  });

  app.patch("/api/admin/role-definitions/:id", requireAdmin, async (req, res, next) => {
    try {
      const def = await storage.updateContractorRoleDefinition(req.params.id, req.body);
      if (!def) return res.status(404).json({ message: "Role definition not found" });
      res.json(def);
    } catch (error) { next(error); }
  });

  app.delete("/api/admin/role-definitions/:id", requireAdmin, async (req, res, next) => {
    try {
      await storage.deleteContractorRoleDefinition(req.params.id);
      res.json({ message: "Role definition deleted" });
    } catch (error) { next(error); }
  });

  // ── Project routes ────────────────────────────────────────────────────────────

  app.get("/api/projects", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      let projects;
      if (user.role === "client") {
        projects = await storage.getProjectsByClientId(user.id);
      } else if (user.role === "company_owner" && user.companyId) {
        // Company owners only see their company's projects
        projects = await storage.getProjectsByCompanyId(user.companyId);
      } else if (user.role === "contractor") {
        if (user.contractorType === "subcontractor" || user.contractorType === "notary") {
          // Subcontractors and notaries: only explicitly assigned projects (cross-company via invite)
          projects = await storage.getContractorProjects(user.id);
        } else if (user.companyId) {
          // Regular contractors (plain): see all company projects
          projects = await storage.getProjectsByCompanyId(user.companyId);
        } else {
          projects = await storage.getContractorProjects(user.id);
        }
      } else {
        // Admins see all
        projects = await storage.getProjects();
      }
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  // Helper: check if a user can access a project
  const canAccessProject = async (user: User, project: any): Promise<boolean> => {
    if (user.role === "admin") return true;
    if (project.clientId === user.id) return true;
    if (project.contractorId === user.id) return true;
    // Company owner or company admin: can see all projects belonging to their company
    if ((user.role === "company_owner" || user.isCompanyAdmin === true) && user.companyId) {
      const contractor = await storage.getUser(project.contractorId);
      if (contractor && contractor.companyId === user.companyId) return true;
    }
    // Subcontractors and notaries: ONLY via explicit projectTeamMembers assignment
    if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
      const teamMembers = await storage.getProjectTeamMembers(project.id);
      return teamMembers.some(m => m.contractorId === user.id);
    }
    // Regular contractors (non-external): allow if in same company
    if (user.role === "contractor" && user.contractorType !== "subcontractor" && user.contractorType !== "notary" && user.companyId) {
      const contractor = await storage.getUser(project.contractorId);
      if (contractor && contractor.companyId === user.companyId) return true;
    }
    return false;
  };

  // Helper: enforce per-project permissions for external (sub/notary) users
  // Returns true if the user is allowed to perform the action; false otherwise
  const checkExternalPermission = async (user: User, projectId: string, permKey: keyof ExternalMemberPermissions): Promise<boolean> => {
    const isExternal = user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary");
    if (!isExternal) return true; // non-external users are not restricted by per-project permissions
    const membership = await storage.getProjectTeamMemberByContractorAndProject(projectId, user.id);
    if (!membership) return false;
    const perms = membership.permissions as Record<string, boolean> | null;
    return perms?.[permKey] === true;
  };

  // Automatic project access guard — runs for every route with a :projectId param
  // Ensures consistent IDOR protection across all project-scoped endpoints
  app.param("projectId", async (req: any, res: any, next: any, projectId: string) => {
    // Deny unauthenticated callers; don't defer to per-route requireAuth
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    try {
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!(await canAccessProject(req.user as User, project))) {
        return res.status(403).json({ message: "Access denied to this project" });
      }
      (req as any).project = project; // cache for downstream handlers
      next();
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res, next) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const user = req.user as User;
      if (!(await canAccessProject(user, project))) {
        return res.status(403).json({ message: "Access denied" });
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

      // Strip budget fields for external users (sub/notary) who lack canViewBudget permission
      const hasBudgetAccess = await checkExternalPermission(user, project.id, 'canViewBudget');
      const projectPayload = hasBudgetAccess
        ? { ...project, client }
        : { ...project, client, budget: null, budgetStatus: null };

      res.json(projectPayload);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects", requireAuth, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;
      // External users (subcontractors, notaries) are read-only and cannot create projects
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "External users cannot create projects" });
      }
      const parsed = createProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid project data", errors: parsed.error.flatten().fieldErrors });
      }
      const project = await storage.createProject({
        ...parsed.data,
        budget: parsed.data.budget != null ? String(parsed.data.budget) : undefined,
        contractorId: user.id,
      });
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/projects/:id", requireAuth, requireActiveSubscription, async (req, res, next) => {
    try {
      // Get current project to check progress change
      const currentProject = await storage.getProject(req.params.id);
      if (!currentProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      const user = req.user as User;
      if (!(await canAccessProject(user, currentProject))) {
        return res.status(403).json({ message: "Access denied" });
      }
      // External users (subcontractors, notaries) are read-only; only company members can edit
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "External users cannot edit projects" });
      }
      
      const parsedUpdate = updateProjectSchema.safeParse(req.body);
      if (!parsedUpdate.success) {
        return res.status(400).json({ message: "Invalid project data", errors: parsedUpdate.error.flatten().fieldErrors });
      }

      const oldProgress = currentProject.progress || 0;
      const newProgress = parsedUpdate.data.progress;
      
      const project = await storage.updateProject(req.params.id, {
        ...parsedUpdate.data,
        budget: parsedUpdate.data.budget != null ? String(parsedUpdate.data.budget) : undefined,
      });
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Trigger SharePoint backup when project reaches 100% progress
      if (newProgress !== undefined && shouldTriggerBackup(oldProgress, newProgress)) {
        console.log(`[Backup] Triggering backup for project ${project.id} - progress reached 100%`);
        createProjectBackup(project.id)
          .then(result => {
            if (result.success) {
              console.log(`[Backup] Successfully created backup for ${result.projectName}: ${result.uploadedFiles} files`);
            } else {
              console.error(`[Backup] Backup had errors:`, result.errors);
            }
          })
          .catch(err => console.error('[Backup] Failed to create backup:', err));
      }
      
      const projectBroadcastCtx = await getProjectBroadcastContext(project.id, (req.user as User).companyId);
      broadcast({ type: "project", projectId: project.id, ...projectBroadcastCtx });
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

  app.post("/api/estimates", requireAuth, requireActiveSubscription, async (req, res, next) => {
    try {
      const parsedEstimate = createEstimateSchema.safeParse(req.body);
      if (!parsedEstimate.success) {
        return res.status(400).json({ message: "Invalid estimate data", errors: parsedEstimate.error.flatten().fieldErrors });
      }
      const { lineItems, ...estimateData } = parsedEstimate.data;
      const estimate = await storage.createEstimate(estimateData);
      
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createEstimateLineItem({
            ...item,
            estimateId: estimate.id,
          });
        }
      }
      
      if (estimate.projectId) {
        const estimateBroadcastCtx = await getProjectBroadcastContext(estimate.projectId, (req.user as User).companyId);
        broadcast({ type: "estimate", projectId: estimate.projectId, ...estimateBroadcastCtx });
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

  app.post("/api/invoices", requireAuth, requireActiveSubscription, async (req, res, next) => {
    try {
      const parsedInvoice = createInvoiceSchema.safeParse(req.body);
      if (!parsedInvoice.success) {
        return res.status(400).json({ message: "Invalid invoice data", errors: parsedInvoice.error.flatten().fieldErrors });
      }
      const { lineItems, ...invoiceData } = parsedInvoice.data;
      const invoice = await storage.createInvoice(invoiceData);
      
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createInvoiceLineItem({
            ...item,
            invoiceId: invoice.id,
          });
        }
      }
      
      if (invoice.projectId) {
        const invoiceBroadcastCtx = await getProjectBroadcastContext(invoice.projectId, (req.user as User).companyId);
        broadcast({ type: "invoice", projectId: invoice.projectId, ...invoiceBroadcastCtx });
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
      const parsedBilling = createRecurringBillingSchema.safeParse(req.body);
      if (!parsedBilling.success) {
        return res.status(400).json({ message: "Invalid recurring billing data", errors: parsedBilling.error.flatten().fieldErrors });
      }
      const billing = await storage.createRecurringBilling(parsedBilling.data);
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
      const parsedPhase = createPhaseSchema.safeParse(req.body);
      if (!parsedPhase.success) {
        return res.status(400).json({ message: "Invalid phase data", errors: parsedPhase.error.flatten().fieldErrors });
      }
      const phase = await storage.createProjectPhase({
        ...parsedPhase.data,
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

  // Timeline delay routes
  app.post("/api/phases/:phaseId/delay", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only project managers can delay phases" });
      }
      
      const { delayDays, projectId } = req.body;
      if (!delayDays || typeof delayDays !== 'number' || delayDays <= 0) {
        return res.status(400).json({ message: "delayDays must be a positive number" });
      }
      if (!projectId) {
        return res.status(400).json({ message: "projectId is required" });
      }

      // Get the phase and verify it belongs to the specified project
      const phase = await storage.getProjectPhase(req.params.phaseId);
      if (!phase) {
        return res.status(404).json({ message: "Phase not found" });
      }
      if (phase.projectId !== projectId) {
        return res.status(400).json({ message: "Phase does not belong to the specified project" });
      }

      // Verify user has access to this project (must be assigned or admin)
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      if (user.role !== 'admin' && project.contractorId !== user.id) {
        return res.status(403).json({ message: "You don't have permission to modify this project" });
      }

      const result = await storage.delayPhase(req.params.phaseId, delayDays, projectId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/milestone-tasks/:taskId/delay", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only project managers can delay tasks" });
      }
      
      const { delayDays } = req.body;
      if (!delayDays || typeof delayDays !== 'number' || delayDays <= 0) {
        return res.status(400).json({ message: "delayDays must be a positive number" });
      }

      // Get task to verify project access
      const task = await storage.getMilestoneTask(req.params.taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Verify user has access to this project (must be assigned or admin)
      const project = await storage.getProject(task.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      if (user.role !== 'admin' && project.contractorId !== user.id) {
        return res.status(403).json({ message: "You don't have permission to modify this project" });
      }

      const taskResult = await storage.delayTask(req.params.taskId, delayDays);
      res.json(taskResult);
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
      const parsedItem = createActionItemSchema.safeParse(req.body);
      if (!parsedItem.success) {
        return res.status(400).json({ message: "Invalid action item data", errors: parsedItem.error.flatten().fieldErrors });
      }
      const item = await storage.createActionItem({
        ...parsedItem.data,
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
      const user = req.user as User;
      const image = await storage.createInspirationImage({
        ...req.body,
        projectId: req.params.projectId,
        creatorId: user.id,
        creatorName: user.name || user.username,
      });
      res.json(image);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/inspiration/:imageId", requireAuth, async (req, res, next) => {
    try {
      await storage.deleteInspirationImage(req.params.imageId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Message routes
  app.get("/api/projects/:projectId/messages", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!await checkExternalPermission(user, req.params.projectId, 'canViewMessages')) {
        return res.status(403).json({ message: "You do not have permission to view messages for this project" });
      }
      const messages = await storage.getMessages(req.params.projectId);
      // Add isOwn flag to each message
      const messagesWithOwnership = messages.map(msg => ({
        ...msg,
        isOwn: msg.senderId === user.id
      }));
      res.json(messagesWithOwnership);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/messages", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!await checkExternalPermission(user, req.params.projectId, 'canPostMessages')) {
        return res.status(403).json({ message: "You do not have permission to post messages in this project" });
      }
      const message = await storage.createMessage({
        ...req.body,
        projectId: req.params.projectId,
        senderId: user.id,
        senderName: user.name || user.username,
        senderAvatar: req.body.senderAvatar || (user.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : user.username.slice(0, 2).toUpperCase()),
      });
      const msgBroadcastCtx = await getProjectBroadcastContext(req.params.projectId, user.companyId);
      broadcast({ type: "messages", projectId: req.params.projectId, ...msgBroadcastCtx });
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // Update message (edit)
  app.put("/api/messages/:messageId", requireAuth, async (req, res, next) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      const message = await storage.updateMessage(req.params.messageId, content);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      if (message.projectId) {
        const editBroadcastCtx = await getProjectBroadcastContext(message.projectId, (req.user as User).companyId);
        broadcast({ type: "messages", projectId: message.projectId, ...editBroadcastCtx });
      }
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // Delete message (soft delete)
  app.delete("/api/messages/:messageId", requireAuth, async (req, res, next) => {
    try {
      const message = await storage.deleteMessage(req.params.messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      if (message.projectId) {
        const delBroadcastCtx = await getProjectBroadcastContext(message.projectId, (req.user as User | undefined)?.companyId);
        broadcast({ type: "messages", projectId: message.projectId, ...delBroadcastCtx });
      }
      res.json(message);
    } catch (error) {
      next(error);
    }
  });

  // Mark messages as read
  app.post("/api/projects/:projectId/messages/read", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      await storage.markProjectMessagesAsRead(req.params.projectId, user.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Progress Post routes
  app.get("/api/projects/:projectId/posts", requireAuth, async (req, res, next) => {
    try {
      const posts = await storage.getProgressPosts(req.params.projectId);
      res.json(posts);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/posts/:postId", requireAuth, async (req, res, next) => {
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

  app.post("/api/projects/:projectId/posts", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      
      // Only contractors and admins can create posts
      if (user.role !== 'contractor' && user.role !== 'admin' && user.role !== 'company_owner') {
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

  // Contractor Photo routes (contractor-only, clients cannot access)
  app.get("/api/projects/:projectId/contractor-photos", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Only contractors and admins can view contractor photos
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const photos = await storage.getContractorPhotos(req.params.projectId);
      res.json(photos);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/contractor-photos/:photoId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const photo = await storage.getContractorPhoto(req.params.photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      res.json(photo);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/contractor-photos", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Only contractors and admins can create contractor photos
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can create contractor photos" });
      }
      
      const photo = await storage.createContractorPhoto({
        ...req.body,
        projectId: req.params.projectId,
        creatorId: user.id,
        creatorName: user.name || 'Contractor',
      });
      res.json(photo);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/contractor-photos/:photoId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check photo ownership - admins can delete any, contractors only their own
      const photo = await storage.getContractorPhoto(req.params.photoId);
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      if (user.role !== 'admin' && photo.creatorId !== user.id) {
        return res.status(403).json({ message: "You can only delete your own photos" });
      }
      
      await storage.deleteContractorPhoto(req.params.photoId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Project Document routes (contractor/admin can upload, all authenticated users can view)
  app.get("/api/projects/:projectId/documents", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!await checkExternalPermission(user, req.params.projectId, 'canViewDocuments')) {
        return res.status(403).json({ message: "You do not have permission to view documents for this project" });
      }
      const documents = await storage.getProjectDocuments(req.params.projectId);
      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:projectId/documents/type/:type", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!await checkExternalPermission(user, req.params.projectId, 'canViewDocuments')) {
        return res.status(403).json({ message: "You do not have permission to view documents for this project" });
      }
      const documents = await storage.getProjectDocumentsByType(req.params.projectId, req.params.type);
      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/documents/:documentId", requireAuth, async (req, res, next) => {
    try {
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/documents", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Only contractors and admins can upload documents; sub/notary require explicit canUploadDocuments permission
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can upload documents" });
      }
      if (!await checkExternalPermission(user, req.params.projectId, 'canUploadDocuments')) {
        return res.status(403).json({ message: "You do not have permission to upload documents for this project" });
      }
      
      const document = await storage.createProjectDocument({
        ...req.body,
        projectId: req.params.projectId,
        uploadedById: user.id,
        uploadedByName: user.name || 'Contractor',
      });
      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/documents/:documentId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check document ownership - admins can delete any, contractors only their own
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (user.role !== 'admin' && document.uploadedById !== user.id) {
        return res.status(403).json({ message: "You can only delete your own documents" });
      }
      
      await storage.deleteProjectDocument(req.params.documentId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Get document info for signature field placement
  app.get("/api/documents/:documentId/info", requireAuth, async (req, res, next) => {
    try {
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json({ 
        id: document.id,
        name: document.name,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        pageCount: 1
      });
    } catch (error) {
      next(error);
    }
  });

  // Notary Profile routes (contractors/admins can manage notary profiles for autofill)
  app.get("/api/notary-profiles", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const profiles = await storage.getNotaryProfiles(user.id);
      res.json(profiles);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/notary-profiles/:id", requireAuth, async (req, res, next) => {
    try {
      const profile = await storage.getNotaryProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Notary profile not found" });
      }
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/notary-profiles", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can create notary profiles" });
      }
      const profile = await storage.createNotaryProfile({
        ...req.body,
        createdById: user.id,
      });
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/notary-profiles/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const profile = await storage.getNotaryProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Notary profile not found" });
      }
      if (user.role !== 'admin' && profile.createdById !== user.id) {
        return res.status(403).json({ message: "You can only edit your own notary profiles" });
      }
      const updated = await storage.updateNotaryProfile(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/notary-profiles/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      const profile = await storage.getNotaryProfile(req.params.id);
      if (!profile) {
        return res.status(404).json({ message: "Notary profile not found" });
      }
      if (user.role !== 'admin' && profile.createdById !== user.id) {
        return res.status(403).json({ message: "You can only delete your own notary profiles" });
      }
      await storage.deleteNotaryProfile(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Notary Portal routes (for notary users to search and upload notarized documents)
  // Returns documents (not projects) with their project details for the notary portal list view
  // Helper: check if user is a notary (legacy role='notary' or new contractor+notary type)
  const isNotaryUser = (u: User) =>
    u.role === 'notary' || (u.role === 'contractor' && u.contractorType === 'notary');

  app.get("/api/notary/projects", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!isNotaryUser(user) && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { search, status } = req.query;
      
      // Get all documents needing notarization
      const docsNeedingNotarization = await storage.getDocumentsNeedingNotarization();
      
      // Enrich documents with project and user details
      const enrichedDocs = await Promise.all(
        docsNeedingNotarization.map(async (doc) => {
          const project = await storage.getProject(doc.projectId);
          if (!project) return null;
          
          // Skip completed projects
          if (project.status === 'completed') return null;
          
          const client = project.clientId ? await storage.getUser(project.clientId) : null;
          const contractor = project.contractorId ? await storage.getUser(project.contractorId) : null;
          
          return {
            id: doc.id,
            name: doc.name,
            fileUrl: doc.fileUrl,
            notarizationStatus: doc.notarizationStatus || 'pending',
            notarizationDueDate: doc.notarizationDueDate,
            notarizedFileUrl: doc.notarizedFileUrl,
            notarizationRejectionReason: doc.notarizationRejectionReason,
            projectId: doc.projectId,
            projectName: project.name,
            projectAddress: project.address || '',
            clientName: client?.name || 'Unknown',
            contractorName: contractor?.name || 'Unknown',
            createdAt: doc.createdAt,
          };
        })
      );
      
      let filteredDocs = enrichedDocs.filter(d => d !== null);
      
      // Apply status filter
      if (status && typeof status === 'string' && status !== 'all') {
        filteredDocs = filteredDocs.filter(d => d!.notarizationStatus === status);
      }
      
      // Apply search filter
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        filteredDocs = filteredDocs.filter(d =>
          d!.name.toLowerCase().includes(searchLower) ||
          d!.projectName.toLowerCase().includes(searchLower) ||
          d!.projectAddress.toLowerCase().includes(searchLower) ||
          d!.clientName.toLowerCase().includes(searchLower) ||
          d!.contractorName.toLowerCase().includes(searchLower)
        );
      }
      
      res.json(filteredDocs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/notary/projects/:projectId/documents", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!isNotaryUser(user) && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const documents = await storage.getDocumentsNeedingNotarizationByProject(req.params.projectId);
      
      // Enrich with notary profile info
      const enrichedDocs = await Promise.all(
        documents.map(async (doc) => {
          const notaryProfile = doc.notaryProfileId ? await storage.getNotaryProfile(doc.notaryProfileId) : null;
          return {
            ...doc,
            recommendedNotary: notaryProfile,
          };
        })
      );
      
      res.json(enrichedDocs);
    } catch (error) {
      next(error);
    }
  });

  // Notary uploads notarized document
  app.post("/api/notary/documents/:documentId/upload-notarized", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!isNotaryUser(user) && user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!document.requiresNotarization) {
        return res.status(400).json({ message: "This document does not require notarization" });
      }
      
      const { notarizedFileUrl } = req.body;
      if (!notarizedFileUrl) {
        return res.status(400).json({ message: "Notarized file URL is required" });
      }
      
      const updated = await storage.updateProjectDocument(req.params.documentId, {
        notarizedFileUrl,
        notarizedUploadedById: user.id,
        notarizedUploadedByName: user.name || 'Notary',
        notarizedUploadedAt: new Date(),
        notarizationStatus: 'awaiting_approval',
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Approve notarized document (contractor/admin only)
  app.post("/api/documents/:documentId/approve-notarized", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only Project Managers and admins can approve notarized documents" });
      }
      
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.notarizationStatus !== 'awaiting_approval') {
        return res.status(400).json({ message: "Document is not awaiting approval" });
      }
      
      if (!document.notarizedFileUrl) {
        return res.status(400).json({ message: "No notarized document has been uploaded" });
      }
      
      // Replace original with notarized version and mark as completed
      const updated = await storage.updateProjectDocument(req.params.documentId, {
        fileUrl: document.notarizedFileUrl,
        notarizationStatus: 'completed',
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Reject notarized document (contractor/admin only)
  app.post("/api/documents/:documentId/reject-notarized", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only Project Managers and admins can reject notarized documents" });
      }
      
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.notarizationStatus !== 'awaiting_approval') {
        return res.status(400).json({ message: "Document is not awaiting approval" });
      }
      
      const { reason } = req.body;
      
      // Clear notarized file and reset to pending with rejection reason
      const updated = await storage.updateProjectDocument(req.params.documentId, {
        notarizedFileUrl: null,
        notarizedUploadedById: null,
        notarizedUploadedByName: null,
        notarizedUploadedAt: null,
        notarizationStatus: 'pending',
        notarizationRejectionReason: reason || null,
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Client uploads notarized document (external notarization path)
  app.post("/api/documents/:documentId/upload-notarized", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!document.requiresNotarization) {
        return res.status(400).json({ message: "This document does not require notarization" });
      }
      
      // Check that user has access to this project
      const project = await storage.getProject(document.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (user.role === 'client' && project.clientId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { notarizedFileUrl } = req.body;
      if (!notarizedFileUrl) {
        return res.status(400).json({ message: "Notarized file URL is required" });
      }
      
      const updated = await storage.updateProjectDocument(req.params.documentId, {
        notarizedFileUrl,
        notarizedUploadedById: user.id,
        notarizedUploadedByName: user.name || 'Client',
        notarizedUploadedAt: new Date(),
        notarizationStatus: 'awaiting_approval',
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Contractor approves/rejects notarized document
  app.post("/api/documents/:documentId/approve-notarization", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can approve notarization" });
      }
      
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.notarizationStatus !== 'awaiting_approval') {
        return res.status(400).json({ message: "Document is not awaiting approval" });
      }
      
      if (!document.notarizedFileUrl) {
        return res.status(400).json({ message: "No notarized file uploaded" });
      }
      
      // Replace original file with notarized version and mark as completed
      const updated = await storage.updateProjectDocument(req.params.documentId, {
        fileUrl: document.notarizedFileUrl,
        notarizationStatus: 'completed',
        name: document.name.includes('(Notarized)') ? document.name : `${document.name} (Notarized)`,
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents/:documentId/reject-notarization", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can reject notarization" });
      }
      
      const document = await storage.getProjectDocument(req.params.documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.notarizationStatus !== 'awaiting_approval') {
        return res.status(400).json({ message: "Document is not awaiting approval" });
      }
      
      // Reset to pending, clear uploaded notarized file
      const updated = await storage.updateProjectDocument(req.params.documentId, {
        notarizedFileUrl: null,
        notarizedUploadedById: null,
        notarizedUploadedByName: null,
        notarizedUploadedAt: null,
        notarizationStatus: 'pending',
      });
      
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Client Material Items routes
  app.get("/api/projects/:projectId/materials", requireAuth, async (req, res, next) => {
    try {
      const items = await storage.getClientMaterialItems(req.params.projectId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:projectId/materials/has-items", requireAuth, async (req, res, next) => {
    try {
      const hasItems = await storage.hasClientMaterialItems(req.params.projectId);
      res.json({ hasItems });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/materials", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only Project Managers can add material items" });
      }
      
      const { name, description, dueDate } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Item name is required" });
      }
      
      const item = await storage.createClientMaterialItem({
        projectId: req.params.projectId,
        name,
        description: description || null,
        dueDate: dueDate || null,
        isCompleted: false,
        completedAt: null,
        completedById: null,
        completedByName: null,
        createdById: user.id,
        createdByName: user.name || user.username,
      });
      
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/materials/:itemId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const item = await storage.getClientMaterialItem(req.params.itemId);
      
      if (!item) {
        return res.status(404).json({ message: "Material item not found" });
      }
      
      const { name, description, dueDate, isCompleted } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (dueDate !== undefined) updateData.dueDate = dueDate;
      
      // Handle completion toggle
      if (isCompleted !== undefined) {
        updateData.isCompleted = isCompleted;
        if (isCompleted) {
          updateData.completedAt = new Date();
          updateData.completedById = user.id;
          updateData.completedByName = user.name || user.username;
        } else {
          updateData.completedAt = null;
          updateData.completedById = null;
          updateData.completedByName = null;
        }
      }
      
      // Only allow contractors/admins to edit name, description, dueDate
      if (user.role !== 'contractor' && user.role !== 'admin') {
        // Clients can only toggle completion
        if (name !== undefined || description !== undefined || dueDate !== undefined) {
          return res.status(403).json({ message: "Only Project Managers can edit item details" });
        }
      }
      
      const updated = await storage.updateClientMaterialItem(req.params.itemId, updateData);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/materials/:itemId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only Project Managers can delete material items" });
      }
      
      const item = await storage.getClientMaterialItem(req.params.itemId);
      if (!item) {
        return res.status(404).json({ message: "Material item not found" });
      }
      
      await storage.deleteClientMaterialItem(req.params.itemId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Change Order routes
  app.get("/api/projects/:projectId/change-orders", requireAuth, async (req, res, next) => {
    try {
      const changeOrders = await storage.getChangeOrders(req.params.projectId);
      res.json(changeOrders);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/change-orders/:orderId", requireAuth, async (req, res, next) => {
    try {
      const order = await storage.getChangeOrder(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Change order not found" });
      }
      res.json(order);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/change-orders/:orderId/line-items", requireAuth, async (req, res, next) => {
    try {
      const lineItems = await storage.getChangeOrderLineItems(req.params.orderId);
      res.json(lineItems);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/projects/:projectId/change-orders", requireAuth, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can create change orders" });
      }

      const parsedCO = createChangeOrderSchema.safeParse(req.body);
      if (!parsedCO.success) {
        return res.status(400).json({ message: "Invalid change order data", errors: parsedCO.error.flatten().fieldErrors });
      }
      const { title, description, reason, costImpact, timelineImpact, lineItems } = parsedCO.data;
      const orderNumber = await storage.getNextChangeOrderNumber(req.params.projectId);

      const changeOrder = await storage.createChangeOrder({
        projectId: req.params.projectId,
        orderNumber,
        title,
        description,
        reason,
        costImpact: costImpact != null ? String(costImpact) : "0",
        timelineImpact: timelineImpact || 0,
        status: "pending",
        createdById: user.id,
        createdByName: user.name || user.username,
      });

      // Create line items if provided
      if (lineItems && Array.isArray(lineItems)) {
        for (const item of lineItems) {
          await storage.createChangeOrderLineItem({
            changeOrderId: changeOrder.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            amount: item.amount,
          });
        }
      }

      const coBroadcastCtx = await getProjectBroadcastContext(req.params.projectId, user.companyId);
      broadcast({ type: "changeorder", projectId: req.params.projectId, ...coBroadcastCtx });
      res.status(201).json(changeOrder);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/change-orders/:orderId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const order = await storage.getChangeOrder(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Change order not found" });
      }

      // Only contractor can edit pending orders
      if (order.status !== 'pending' && user.role !== 'admin') {
        return res.status(403).json({ message: "Can only edit pending change orders" });
      }

      const { title, description, reason, costImpact, timelineImpact, lineItems } = req.body;
      
      const updated = await storage.updateChangeOrder(req.params.orderId, {
        title,
        description,
        reason,
        costImpact,
        timelineImpact,
      });

      // Update line items if provided
      if (lineItems && Array.isArray(lineItems)) {
        await storage.deleteChangeOrderLineItems(req.params.orderId);
        for (const item of lineItems) {
          await storage.createChangeOrderLineItem({
            changeOrderId: req.params.orderId,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            amount: item.amount,
          });
        }
      }

      if (order.projectId) {
        const updBroadcastCtx = await getProjectBroadcastContext(order.projectId, user.companyId);
        broadcast({ type: "changeorder", projectId: order.projectId, ...updBroadcastCtx });
      }
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/change-orders/:orderId/approve", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const order = await storage.getChangeOrder(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Change order not found" });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({ message: "Change order is not pending" });
      }

      // Update the change order status
      const updated = await storage.updateChangeOrder(req.params.orderId, {
        status: "approved",
        approvedById: user.id,
        approvedByName: user.name || user.username,
        approvedAt: new Date(),
      });

      // Update project budget and timeline
      const project = await storage.getProject(order.projectId);
      if (project) {
        const currentBudget = parseFloat(project.budget?.toString() || "0");
        const costImpact = parseFloat(order.costImpact?.toString() || "0");
        const newBudget = currentBudget + costImpact;

        // Calculate new due date if timeline impact
        let newDueDate = project.dueDate;
        if (order.timelineImpact && order.timelineImpact !== 0 && project.dueDate) {
          const dueDate = new Date(project.dueDate);
          dueDate.setDate(dueDate.getDate() + order.timelineImpact);
          newDueDate = dueDate.toISOString().split('T')[0];
        }

        await storage.updateProject(order.projectId, {
          budget: newBudget.toString(),
          dueDate: newDueDate,
        });
      }

      const approveBroadcastCtx = await getProjectBroadcastContext(order.projectId, user.companyId);
      broadcast({ type: "changeorder", projectId: order.projectId, ...approveBroadcastCtx });
      broadcast({ type: "project", projectId: order.projectId, ...approveBroadcastCtx });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/change-orders/:orderId/reject", requireAuth, async (req, res, next) => {
    try {
      const order = await storage.getChangeOrder(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Change order not found" });
      }

      if (order.status !== 'pending') {
        return res.status(400).json({ message: "Change order is not pending" });
      }

      const { reason } = req.body;
      const updated = await storage.updateChangeOrder(req.params.orderId, {
        status: "rejected",
        rejectionReason: reason,
      });

      const rejectBroadcastCtx = await getProjectBroadcastContext(order.projectId, (req.user as User).companyId);
      broadcast({ type: "changeorder", projectId: order.projectId, ...rejectBroadcastCtx });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/change-orders/:orderId", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'contractor' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only contractors can delete change orders" });
      }

      const order = await storage.getChangeOrder(req.params.orderId);
      if (!order) {
        return res.status(404).json({ message: "Change order not found" });
      }

      if (order.status !== 'pending') {
        return res.status(403).json({ message: "Can only delete pending change orders" });
      }

      await storage.deleteChangeOrder(req.params.orderId);
      res.status(204).send();
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
      const companyOwners = await storage.getUsersByRole("company_owner");
      const admins = await storage.getUsersByRole("admin");
      const allUsers = [...companyOwners, ...contractors, ...admins];
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

  // Get approved contractors for team member selection — scoped to caller's company
  app.get("/api/contractors", requireAuth, async (req, res, next) => {
    try {
      const caller = req.user as User;
      const contractors = await storage.getUsersByRole("contractor");
      // Admins see all; others see only their own company's contractors
      const scoped = caller.role === "admin"
        ? contractors
        : contractors.filter(c => c.companyId === caller.companyId);
      const approvedContractors = scoped.filter(c => c.isApproved && !c.isSandbox);
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

  // Get user by ID
  app.get("/api/users/:id", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role
      });
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
      
      // Sanitize user data in participants (remove password, include role)
      const sanitizedChats = chats.map(chat => ({
        ...chat,
        participants: chat.participants.map(p => ({
          ...p,
          user: p.user ? {
            id: p.user.id,
            name: p.user.name,
            username: p.user.username,
            profilePicture: p.user.profilePicture,
            companyName: p.user.companyName,
            companyType: p.user.companyType,
            role: p.user.role
          } : undefined
        }))
      }));
      
      res.json(sanitizedChats);
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

      // Broadcast to all chat participants so they see the new message without refresh
      if (chat.projectId) {
        const chatParticipants = await storage.getChatParticipants(req.params.chatId).catch(() => []);
        const participantUserIds = chatParticipants.map((p) => p.userId).filter(Boolean) as string[];
        broadcast({
          type: "chatmessage",
          chatId: req.params.chatId,
          projectId: chat.projectId,
          companyId: user.companyId,
          allowedUserIds: participantUserIds,
        });
      }

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

  // Contractor Calculator routes - Access for contractors, company_owners, and admins
  const requireContractorOrAdmin = (req: any, res: any, next: any) => {
    const user = req.user as User | undefined;
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const allowed = user.role === 'contractor' || user.role === 'company_owner' || user.role === 'admin';
    if (!allowed) {
      return res.status(403).json({ message: "Access denied" });
    }
    // Non-admin contractors must be approved
    if ((user.role === 'contractor' || user.role === 'company_owner') && !user.isApproved) {
      return res.status(403).json({ message: "Your account is pending approval" });
    }
    next();
  };

  app.get("/api/calculator/categories", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      const categories = companyId
        ? await storage.getCompanyPriceBookCategories(companyId)
        : [];
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/calculator/categories/:id/items", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      const items = companyId
        ? await storage.getCompanyPriceBookItemsByCategory(req.params.id, companyId)
        : [];
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/calculator/items", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      const items = companyId
        ? await storage.getCompanyPriceBookItems(companyId)
        : [];
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/calculator/items/search", requireContractorOrAdmin, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      const query = (req.query.q as string) || '';
      const items = companyId ? await storage.getCompanyPriceBookItems(companyId) : [];
      const filtered = items.filter((item: any) =>
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.itemType.toLowerCase().includes(query.toLowerCase())
      );
      res.json(filtered);
    } catch (error) {
      next(error);
    }
  });

  // ── Company Price Book CRUD routes ────────────────────────────────────────────
  // Company owner/admin can manage their own price book

  app.get("/api/company/price-book/categories", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      const categories = await storage.getCompanyPriceBookCategories(companyId);
      res.json(categories);
    } catch (error) { next(error); }
  });

  app.post("/api/company/price-book/categories", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      const category = await storage.createBudgetCategory({ ...req.body, companyId });
      res.json(category);
    } catch (error) { next(error); }
  });

  app.patch("/api/company/price-book/categories/:id", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      const existing = await storage.getBudgetCategory(req.params.id);
      if (!existing || existing.companyId !== companyId) return res.status(404).json({ message: "Category not found" });
      // Whitelist mutable fields — never allow companyId to change
      const { name, notes, displayOrder, isActive } = req.body;
      const category = await storage.updateBudgetCategory(req.params.id, { name, notes, displayOrder, isActive });
      res.json(category);
    } catch (error) { next(error); }
  });

  app.delete("/api/company/price-book/categories/:id", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      const existing = await storage.getBudgetCategory(req.params.id);
      if (!existing || existing.companyId !== companyId) return res.status(404).json({ message: "Category not found" });
      await storage.deleteBudgetCategory(req.params.id);
      res.json({ message: "Category deleted" });
    } catch (error) { next(error); }
  });

  app.get("/api/company/price-book/items", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      const items = await storage.getCompanyPriceBookItems(companyId);
      res.json(items);
    } catch (error) { next(error); }
  });

  app.post("/api/company/price-book/items", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      // Verify the category belongs to this company
      const category = await storage.getBudgetCategory(req.body.categoryId);
      if (!category || category.companyId !== companyId) return res.status(400).json({ message: "Invalid category" });
      const item = await storage.createBudgetItem({ ...req.body, companyId });
      res.json(item);
    } catch (error) { next(error); }
  });

  app.patch("/api/company/price-book/items/:id", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      const existing = await storage.getBudgetItem(req.params.id);
      if (!existing || existing.companyId !== companyId) return res.status(404).json({ message: "Item not found" });
      // Whitelist mutable fields — never allow companyId to change
      const { description, itemType, unitType, cost, laborRate, materialFee, retailPrice, notes, displayOrder, isActive, categoryId } = req.body;
      // If categoryId is being changed, verify the new category belongs to this company
      if (categoryId && categoryId !== existing.categoryId) {
        const newCat = await storage.getBudgetCategory(categoryId);
        if (!newCat || newCat.companyId !== companyId) {
          return res.status(400).json({ message: "Invalid category" });
        }
      }
      const item = await storage.updateBudgetItem(req.params.id, { description, itemType, unitType, cost, laborRate, materialFee, retailPrice, notes, displayOrder, isActive, categoryId });
      res.json(item);
    } catch (error) { next(error); }
  });

  app.delete("/api/company/price-book/items/:id", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });
      const existing = await storage.getBudgetItem(req.params.id);
      if (!existing || existing.companyId !== companyId) return res.status(404).json({ message: "Item not found" });
      await storage.deleteBudgetItem(req.params.id);
      res.json({ message: "Item deleted" });
    } catch (error) { next(error); }
  });

  // Parse uploaded Excel/CSV file server-side and return rows as JSON
  const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  app.post("/api/company/price-book/parse-file", requireCompanyOwner, uploadMemory.single("file"), (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      res.json({ rows, headers });
    } catch (error) {
      next(error);
    }
  });

  // Bulk import endpoint for price book
  app.post("/api/company/price-book/bulk-import", requireCompanyOwner, async (req, res, next) => {
    try {
      const user = req.user as User;
      const companyId = user.companyId;
      if (!companyId) return res.status(400).json({ message: "No company associated with this account" });

      const { items } = req.body as {
        items: Array<{
          category: string;
          description: string;
          unitType: string;
          laborRate?: string;
          materialFee?: string;
          retailPrice?: string;
          itemType?: string;
          notes?: string;
        }>;
      };

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "No items provided" });
      }

      // Group items by category name
      const categoryMap = new Map<string, typeof items>();
      for (const item of items) {
        const catName = (item.category || "Uncategorized").trim();
        if (!categoryMap.has(catName)) categoryMap.set(catName, []);
        categoryMap.get(catName)!.push(item);
      }

      // Get existing categories for this company
      const existingCategories = await storage.getCompanyPriceBookCategories(companyId);

      let createdCategories = 0;
      let createdItems = 0;

      for (const [catName, catItems] of Array.from(categoryMap.entries())) {
        // Find or create category
        let category = existingCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
        if (!category) {
          category = await storage.createBudgetCategory({
            companyId,
            name: catName,
            notes: null,
            displayOrder: 0,
            isActive: true,
          });
          createdCategories++;
        }

        // Create items in category
        for (const item of catItems) {
          await storage.createBudgetItem({
            categoryId: category.id,
            companyId,
            description: item.description,
            itemType: item.itemType || "",
            unitType: item.unitType || "EA",
            cost: null,
            laborRate: item.laborRate || null,
            materialFee: item.materialFee || null,
            retailPrice: item.retailPrice || null,
            notes: item.notes || null,
            displayOrder: 0,
            isActive: true,
          });
          createdItems++;
        }
      }

      res.json({
        message: `Imported ${createdItems} item${createdItems !== 1 ? "s" : ""} across ${categoryMap.size} categor${categoryMap.size !== 1 ? "ies" : "y"}`,
        createdCategories,
        createdItems,
      });
    } catch (error) { next(error); }
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
      if (!category || category.companyId !== null) {
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
      // Platform reference categories always have companyId = null
      const { name, notes, displayOrder, isActive } = req.body;
      const category = await storage.createBudgetCategory({ name, notes, displayOrder, isActive, companyId: null });
      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/budget/categories/:id", requireAdmin, async (req, res, next) => {
    try {
      const existing = await storage.getBudgetCategory(req.params.id);
      if (!existing || existing.companyId !== null) {
        return res.status(404).json({ message: "Category not found" });
      }
      // Whitelist mutable fields — companyId stays null
      const { name, notes, displayOrder, isActive } = req.body;
      const category = await storage.updateBudgetCategory(req.params.id, { name, notes, displayOrder, isActive });
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
      const existing = await storage.getBudgetCategory(req.params.id);
      if (!existing || existing.companyId !== null) {
        return res.status(404).json({ message: "Category not found" });
      }
      await storage.deleteBudgetCategory(req.params.id);
      res.json({ message: "Category deleted" });
    } catch (error) {
      next(error);
    }
  });

  // Budget Item routes - Admin only
  app.get("/api/budget/categories/:categoryId/items", requireAdmin, async (req, res, next) => {
    try {
      // Verify the category is a platform-level category (companyId = null)
      const cat = await storage.getBudgetCategory(req.params.categoryId);
      if (!cat || cat.companyId !== null) {
        return res.status(404).json({ message: "Category not found" });
      }
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
      if (!item || item.companyId !== null) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/budget/items", requireAdmin, async (req, res, next) => {
    try {
      // Platform reference items always have companyId = null
      const { categoryId, description, itemType, unitType, cost, laborRate, materialFee, retailPrice, notes, displayOrder, isActive } = req.body;
      // Validate that categoryId points to a platform category (companyId = null)
      if (categoryId) {
        const cat = await storage.getBudgetCategory(categoryId);
        if (!cat || cat.companyId !== null) {
          return res.status(400).json({ message: "Invalid category: must be a platform category" });
        }
      }
      const item = await storage.createBudgetItem({ categoryId, description, itemType, unitType, cost, laborRate, materialFee, retailPrice, notes, displayOrder, isActive, companyId: null });
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/budget/items/:id", requireAdmin, async (req, res, next) => {
    try {
      const existing = await storage.getBudgetItem(req.params.id);
      if (!existing || existing.companyId !== null) {
        return res.status(404).json({ message: "Item not found" });
      }
      // Whitelist mutable fields — companyId stays null
      const { categoryId, description, itemType, unitType, cost, laborRate, materialFee, retailPrice, notes, displayOrder, isActive } = req.body;
      // If categoryId is being changed, verify the new category is also a platform category (companyId = null)
      if (categoryId && categoryId !== existing.categoryId) {
        const newCat = await storage.getBudgetCategory(categoryId);
        if (!newCat || newCat.companyId !== null) {
          return res.status(400).json({ message: "Invalid category: must be a platform category" });
        }
      }
      const item = await storage.updateBudgetItem(req.params.id, { categoryId, description, itemType, unitType, cost, laborRate, materialFee, retailPrice, notes, displayOrder, isActive });
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
      const existing = await storage.getBudgetItem(req.params.id);
      if (!existing || existing.companyId !== null) {
        return res.status(404).json({ message: "Item not found" });
      }
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
      const parsedInvite = projectInviteSchema.safeParse(req.body);
      if (!parsedInvite.success) {
        return res.status(400).json({ message: "Invalid invite data", errors: parsedInvite.error.flatten().fieldErrors });
      }
      const { email, clientName } = parsedInvite.data;

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
          clientName: clientName ?? undefined,
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
      if (user.role !== 'contractor' && user.role !== 'admin' && user.role !== 'company_owner') {
        return res.status(403).json({ message: "Only contractors and admins can add team members" });
      }
      // External users (subcontractors, notaries) are read-only; they cannot manage team membership
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "External users (subcontractors and notaries) cannot manage team members" });
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
      if (user.role !== 'contractor' && user.role !== 'admin' && user.role !== 'company_owner') {
        return res.status(403).json({ message: "Only contractors and admins can remove team members" });
      }
      // External users (subcontractors, notaries) are read-only; they cannot manage team membership
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "External users (subcontractors and notaries) cannot manage team members" });
      }
      
      await storage.removeProjectTeamMember(req.params.memberId);
      res.json({ message: "Team member removed" });
    } catch (error) {
      next(error);
    }
  });

  // Update permissions for a project team member (company_owner / isCompanyAdmin / admin only)
  app.patch("/api/projects/:projectId/team/:memberId/permissions", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const canManage = user.role === "company_owner" || user.isCompanyAdmin === true || user.role === "admin";
      if (!canManage) {
        return res.status(403).json({ message: "Only company owners and admins can update permissions" });
      }
      // Security: verify the team member actually belongs to the specified project (prevent IDOR)
      const members = await storage.getProjectTeamMembers(req.params.projectId);
      const member = members.find(m => m.id === req.params.memberId);
      if (!member) {
        return res.status(404).json({ message: "Team member not found in this project" });
      }
      // Access to this project's company already enforced by app.param("projectId") middleware
      const { permissions } = req.body;
      if (!permissions || typeof permissions !== "object") {
        return res.status(400).json({ message: "permissions object is required" });
      }
      const updated = await storage.updateProjectTeamMemberPermissions(req.params.memberId, permissions);
      if (!updated) return res.status(404).json({ message: "Team member not found" });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Invite an external sub/notary to a project by email
  app.post("/api/projects/:projectId/invite-external", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Authorization: company_owner, isCompanyAdmin, platform admin, OR a plain company contractor
      // who is a project team member with isProjectLead = true (project-level admin/lead rights)
      let canInvite = user.role === "company_owner" || user.isCompanyAdmin === true || user.role === "admin";
      if (!canInvite && user.role === "contractor" && !user.contractorType && user.companyId) {
        const membership = await storage.getProjectTeamMemberByContractorAndProject(req.params.projectId, user.id);
        if (membership?.isProjectLead === true) {
          canInvite = true;
        }
      }
      if (!canInvite) {
        return res.status(403).json({ message: "Only company owners, admins, or project leads can invite external members" });
      }

      const parsedExtInvite = externalInviteSchema.safeParse(req.body);
      if (!parsedExtInvite.success) {
        return res.status(400).json({ message: "Invalid invite data", errors: parsedExtInvite.error.flatten().fieldErrors });
      }
      const { email, name, role, permissions } = parsedExtInvite.data;

      // Role is already validated by schema; default to subcontractor if omitted
      const inviteRole: "subcontractor" | "notary" = role ?? "subcontractor";

      // Determine default permissions based on role
      const defaultSubPerms = { canViewDocuments: true, canUploadDocuments: false, canViewBudget: false, canViewMessages: true, canPostMessages: false, canViewEstimates: false };
      const defaultNotaryPerms = { canViewDocuments: true, canUploadDocuments: true, canViewBudget: false, canViewMessages: true, canPostMessages: false, canViewEstimates: false };
      const defaultPerms = inviteRole === "notary" ? defaultNotaryPerms : defaultSubPerms;
      const finalPermissions = permissions && typeof permissions === "object" ? { ...defaultPerms, ...permissions } : defaultPerms;

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS?.split(",")[0]
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : "http://localhost:5000";

      const inviterName = user.name || user.username;

      // Check if this user already exists
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        // Validate they're the right type
        if (existingUser.role !== "contractor" || existingUser.contractorType !== inviteRole) {
          return res.status(400).json({ message: `This user does not have a ${inviteRole} account` });
        }
        // Check if already on this project
        const existing = await storage.getProjectTeamMemberByContractorAndProject(req.params.projectId, existingUser.id);
        if (existing) {
          return res.status(409).json({ message: "This person is already assigned to this project" });
        }
        // Add directly to project team with the correct permissions
        const member = await storage.addProjectTeamMember({
          projectId: req.params.projectId,
          contractorId: existingUser.id,
          role: inviteRole,
          addedBy: user.id,
          permissions: finalPermissions,
        });
        // Send email notification
        try {
          const { sendExternalInviteEmail } = await import("./email");
          await sendExternalInviteEmail(email, {
            inviterName,
            projectName: project.name,
            role: inviteRole,
            loginUrl: `${baseUrl}/auth`,
            isNewUser: false,
            inviteeName: name || existingUser.name || undefined,
          });
        } catch (emailErr) {
          console.error("Failed to send external invite email (non-fatal):", emailErr);
        }
        return res.json({ member, invited: false, message: `${existingUser.name || email} has been added to the project` });
      } else {
        // No existing user — create a contractor invite with permissions embedded
        // Use the inviting user's companyId (callers are always company_owner/admin, so this is the correct company)
        const companyId = user.companyId || null;
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry
        const invite = await storage.createContractorInvite({
          projectId: req.params.projectId,
          companyId: companyId || undefined,
          email,
          token,
          status: "pending",
          contractorType: inviteRole,
          invitedBy: user.id,
          expiresAt,
          permissions: finalPermissions,
        });
        // Send invite email
        try {
          const { sendExternalInviteEmail } = await import("./email");
          await sendExternalInviteEmail(email, {
            inviterName,
            projectName: project.name,
            role: inviteRole,
            loginUrl: `${baseUrl}/auth`,
            registerUrl: `${baseUrl}/auth?mode=register&tab=${inviteRole}`,
            isNewUser: true,
            inviteeName: name || undefined,
          });
        } catch (emailErr) {
          console.error("Failed to send external invite email (non-fatal):", emailErr);
        }
        return res.json({ invite, invited: true, message: `Invitation sent to ${email}` });
      }
    } catch (error) {
      next(error);
    }
  });

  // Get all projects for the logged-in sub/notary with company info + permissions
  app.get("/api/my-projects", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Only external (sub/notary) users use this endpoint
      if (user.role !== "contractor" || (user.contractorType !== "subcontractor" && user.contractorType !== "notary")) {
        return res.status(403).json({ message: "Only subcontractors and notaries can use this endpoint" });
      }
      const projects = await storage.getContractorProjectsWithDetails(user.id);
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  // Get pending invites for the logged-in sub/notary user (enriched with project/company info)
  app.get("/api/my-invites", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Only external (sub/notary) users receive project invites
      if (user.role !== "contractor" || (user.contractorType !== "subcontractor" && user.contractorType !== "notary")) {
        return res.json([]);
      }
      if (!user.email) return res.json([]);
      const invites = await storage.getPendingContractorInvitesByEmail(user.email);
      // Filter out expired ones and enrich with project/company info
      const valid = invites.filter(i => new Date(i.expiresAt) > new Date());
      const enriched = await Promise.all(valid.map(async (invite) => {
        let projectName: string | null = null;
        let companyNameVal: string | null = null;
        if (invite.projectId) {
          const project = await storage.getProject(invite.projectId);
          projectName = project?.name ?? null;
        }
        if (invite.companyId) {
          const company = await storage.getCompany(invite.companyId);
          companyNameVal = company?.name ?? null;
        }
        return { ...invite, projectName, companyName: companyNameVal };
      }));
      res.json(enriched);
    } catch (error) {
      next(error);
    }
  });

  // Accept a pending project invite (sub/notary pressing "Accept" in dashboard)
  app.post("/api/my-invites/:inviteId/accept", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Only sub/notary users can accept project invites
      if (user.role !== "contractor" || (user.contractorType !== "subcontractor" && user.contractorType !== "notary")) {
        return res.status(403).json({ message: "Only subcontractors and notaries can accept project invites" });
      }
      if (!user.email) return res.status(400).json({ message: "Account has no email address" });
      const invites = await storage.getPendingContractorInvitesByEmail(user.email);
      const target = invites.find(i => i.id === req.params.inviteId);
      if (!target) return res.status(404).json({ message: "Invite not found" });
      if (target.email !== user.email) return res.status(403).json({ message: "This invite is not for you" });
      // Enforce expiry at the API layer (not just display layer)
      if (new Date(target.expiresAt) <= new Date()) {
        return res.status(400).json({ message: "This invitation has expired" });
      }
      // Validate the invite was created for the user's contractor type
      if (target.contractorType && target.contractorType !== user.contractorType) {
        return res.status(400).json({ message: `This invitation is for a ${target.contractorType}, not a ${user.contractorType}` });
      }
      await storage.acceptContractorInvite(target.token, user.id);
      res.json({ message: "Invite accepted" });
    } catch (error) {
      next(error);
    }
  });

  // Decline a pending project invite
  app.post("/api/my-invites/:inviteId/decline", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Only sub/notary users can decline project invites
      if (user.role !== "contractor" || (user.contractorType !== "subcontractor" && user.contractorType !== "notary")) {
        return res.status(403).json({ message: "Only subcontractors and notaries can decline project invites" });
      }
      if (!user.email) return res.status(400).json({ message: "Account has no email address" });
      const invites = user.email ? await storage.getPendingContractorInvitesByEmail(user.email) : [];
      const target = invites.find(i => i.id === req.params.inviteId);
      if (!target) return res.status(404).json({ message: "Invite not found" });
      if (target.email !== user.email) return res.status(403).json({ message: "This invite is not for you" });
      await storage.updateContractorInvite(target.id, { status: "expired" });
      res.json({ message: "Invite declined" });
    } catch (error) {
      next(error);
    }
  });

  // Contractor invite routes (for inviting new contractors to join platform)
  app.post("/api/contractor-invites", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Strict authorization: only company_owner, platform admin, or contractor with isCompanyAdmin
      const canInvite =
        user.role === "admin" ||
        user.role === "company_owner" ||
        (user.role === "contractor" && user.isCompanyAdmin === true);
      if (!canInvite) {
        return res.status(403).json({ message: "Only company owners and company admins can invite team members" });
      }
      
      const { email, companyName, companyType, projectId, companyId, contractorType, subcontractorSpecialty } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Validate caller has authority over the specified companyId
      if (companyId && user.role !== 'admin') {
        const isCallerOwner = user.role === "company_owner" && user.companyId === companyId;
        const isCallerAdmin = user.isCompanyAdmin === true && user.companyId === companyId;
        if (!isCallerOwner && !isCallerAdmin) {
          return res.status(403).json({ message: "You can only invite members to your own company" });
        }
      }

      // Validate projectId belongs to caller's company (prevents cross-company project linking)
      if (projectId && user.role !== 'admin') {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }
        const callerCompanyId = companyId || user.companyId;
        if (callerCompanyId) {
          const projectContractor = project.contractorId ? await storage.getUser(project.contractorId) : null;
          const projectCompanyId = projectContractor?.companyId;
          if (projectCompanyId && projectCompanyId !== callerCompanyId) {
            return res.status(403).json({ message: "Project does not belong to your company" });
          }
        }
      }

      // Note: we allow inviting existing users (they can accept by logging in rather than creating new account)
      
      // Generate invite token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const invite = await storage.createContractorInvite({
        email,
        companyName,
        companyType,
        projectId: projectId || null,
        companyId: companyId || null,
        contractorType: contractorType || 'contractor',
        subcontractorSpecialty: subcontractorSpecialty || null,
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
      // Check if email already has an account (for existing-user linking flow)
      const existingUser = await storage.getUserByEmail(invite.email);
      
      res.json({
        email: invite.email,
        companyName: invite.companyName,
        companyType: invite.companyType || invite.contractorType,
        contractorType: invite.contractorType,
        subcontractorSpecialty: invite.subcontractorSpecialty,
        projectId: invite.projectId,
        projectName: project?.name,
        hasExistingAccount: !!existingUser  // lets frontend show login vs register form
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
      
      const { username, password, name, firstName, lastName } = req.body;
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }
      
      let targetUser: User | null = null;
      
      // Check if an account with the invited email already exists (existing user linking)
      const existingByEmail = await storage.getUserByEmail(invite.email);
      if (existingByEmail) {
        // Verify password for existing user (login to accept)
        const passwordMatch = await bcrypt.compare(password, existingByEmail.password);
        if (!passwordMatch) {
          return res.status(401).json({ message: "Invalid credentials for existing account" });
        }
        // Normalize role/subtype for existing accounts — ensures consistent state
        // when the same email is reused across different invite types
        const updates: Partial<User> = {};
        if (invite.contractorType && existingByEmail.contractorType !== invite.contractorType) {
          updates.contractorType = invite.contractorType as any;
        }
        if (invite.companyId && existingByEmail.companyId !== invite.companyId) {
          // Subcontractors span multiple companies — only update companyId for non-subcontractors
          if (invite.contractorType !== 'subcontractor') {
            updates.companyId = invite.companyId;
          }
        }
        if (Object.keys(updates).length > 0) {
          await storage.updateUser(existingByEmail.id, updates);
          targetUser = { ...existingByEmail, ...updates };
        } else {
          targetUser = existingByEmail;
        }
      } else {
        // New user — create account
        if (!username) {
          return res.status(400).json({ message: "Username is required for new account" });
        }
        const existingByUsername = await storage.getUserByUsername(username);
        if (existingByUsername) {
          return res.status(400).json({ message: "Username already taken" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const resolvedName = name || (firstName && lastName ? `${firstName} ${lastName}` : undefined);
        targetUser = await storage.createUser({
          username,
          password: hashedPassword,
          email: invite.email,
          name: resolvedName,
          role: 'contractor',
          contractorType: invite.contractorType || 'contractor',
          subcontractorSpecialty: invite.subcontractorSpecialty || null,
          companyId: invite.companyId || null,
          companyName: invite.companyName,
          companyType: invite.companyType,
          isApproved: true // Auto-approved since they were invited
        });
      }
      
      // If invite is for a company, ensure company membership (upsert)
      if (invite.companyId) {
        const existing = await storage.getCompanyMember(invite.companyId, targetUser.id);
        if (!existing) {
          await storage.addCompanyMember({
            companyId: invite.companyId,
            userId: targetUser.id,
            status: 'active',
          });
        }
      }
      
      // Accept the invite (also adds them to project team if applicable)
      await storage.acceptContractorInvite(req.params.token, targetUser.id);
      
      const { password: _, ...userWithoutPassword } = targetUser;
      res.json({ 
        message: existingByEmail ? "Invite accepted successfully" : "Account created successfully",
        user: userWithoutPassword,
        isExistingUser: !!existingByEmail
      });
    } catch (error) {
      next(error);
    }
  });

  // ============= Document Signing Routes =============
  
  // Helper to strip sensitive data from participant
  const sanitizeParticipant = (p: any) => ({
    id: p.id,
    packetId: p.packetId,
    name: p.name,
    email: p.email,
    role: p.role,
    status: p.status,
    signingOrder: p.signingOrder,
    viewedAt: p.viewedAt,
    signedAt: p.signedAt
    // Note: accessToken, signatureData, signerIp, signerAgent are NOT returned
  });

  // Get all signing packets for a project
  app.get("/api/projects/:projectId/signing-packets", requireAuth, async (req, res, next) => {
    try {
      const packets = await storage.getSigningPackets(req.params.projectId);
      // Get participants for each packet (without sensitive data)
      const packetsWithParticipants = await Promise.all(
        packets.map(async (packet) => {
          const participants = await storage.getSigningParticipants(packet.id);
          return { ...packet, participants: participants.map(sanitizeParticipant) };
        })
      );
      res.json(packetsWithParticipants);
    } catch (error) {
      next(error);
    }
  });

  // Get single signing packet with details
  app.get("/api/signing-packets/:id", requireAuth, async (req, res, next) => {
    try {
      const packet = await storage.getSigningPacket(req.params.id);
      if (!packet) {
        return res.status(404).json({ message: "Signing packet not found" });
      }
      const participants = await storage.getSigningParticipants(packet.id);
      const events = await storage.getSigningEvents(packet.id);
      // Sanitize participants to not expose access tokens
      res.json({ ...packet, participants: participants.map(sanitizeParticipant), events });
    } catch (error) {
      next(error);
    }
  });

  // Create a new signing packet (send document for signature)
  app.post("/api/projects/:projectId/signing-packets", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { documentId, title, message, dueDate, recipients, fields } = req.body;
      
      if (!title || !recipients || recipients.length === 0) {
        return res.status(400).json({ message: "Title and at least one recipient are required" });
      }
      
      // Create the signing packet
      const packet = await storage.createSigningPacket({
        projectId: req.params.projectId,
        documentId: documentId || null,
        title,
        message,
        status: 'pending',
        createdById: user.id,
        createdByName: user.name || user.username,
        dueDate: dueDate ? new Date(dueDate) : null
      });
      
      // Create participants with hashed tokens
      const { generateSecureToken, hashToken } = await import("./storage");
      const participantsWithRawTokens: Array<{ participant: any; rawToken: string }> = [];
      
      const createdParticipants = await Promise.all(
        recipients.map(async (recipient: { email: string; name: string; order?: number }, index: number) => {
          // Generate raw token and hash it for secure storage
          const rawToken = generateSecureToken();
          const tokenHash = hashToken(rawToken);
          
          const participant = await storage.createSigningParticipant({
            packetId: packet.id,
            email: recipient.email,
            name: recipient.name,
            role: 'signer',
            signingOrder: recipient.order || index + 1,
            status: 'pending',
            accessToken: tokenHash // Store only the hash
          });
          
          // Keep raw token temporarily for email sending (never stored)
          participantsWithRawTokens.push({ participant, rawToken });
          return participant;
        })
      );
      
      // Create signing fields if provided (only if we have participants)
      if (fields && Array.isArray(fields) && fields.length > 0 && createdParticipants.length > 0) {
        const positionMap = { top: 10, middle: 50, bottom: 85 };
        await Promise.all(
          fields.map(async (field: { 
            fieldType: string; 
            pageNumber: number; 
            position?: string; 
            recipientIndex?: number;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
          }) => {
            // Always use first participant (since we only have one recipient - the project client)
            const participant = createdParticipants[0];
            
            // Only create field if we have a valid participant with an ID
            if (participant?.id) {
              // Support both visual editor format (x, y, width, height) and legacy format (position)
              const xPosition = field.x !== undefined ? field.x : 50;
              const yPosition = field.y !== undefined ? field.y : (positionMap[field.position as keyof typeof positionMap] || 85);
              const width = field.width !== undefined ? field.width : (field.fieldType === 'signature' ? 30 : 15);
              const height = field.height !== undefined ? field.height : (field.fieldType === 'signature' ? 10 : 5);
              
              await storage.createSigningField({
                packetId: packet.id,
                participantId: participant.id,
                fieldType: field.fieldType,
                pageNumber: field.pageNumber,
                xPosition,
                yPosition,
                width,
                height,
                isRequired: true
              });
            }
          })
        );
      }

      // Update document signature status if linked
      if (documentId) {
        await storage.updateProjectDocument(documentId, {
          signatureStatus: 'pending_signature',
          pendingPacketId: packet.id
        });
      }

      // Create audit event
      await storage.createSigningEvent({
        packetId: packet.id,
        eventType: 'created',
        actorName: user.name || user.username,
        actorEmail: user.email || undefined,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Log sent event
      await storage.createSigningEvent({
        packetId: packet.id,
        eventType: 'sent',
        actorName: user.name || user.username,
        actorEmail: user.email || undefined,
        metadata: JSON.stringify({ recipientCount: recipients.length })
      });
      
      // Send email notifications with raw tokens (never stored)
      try {
        const { sendSignatureRequestEmail } = await import("./email");
        await Promise.all(
          participantsWithRawTokens.map(async ({ participant, rawToken }) => {
            await sendSignatureRequestEmail(participant.email, {
              recipientName: participant.name,
              documentTitle: title,
              senderName: user.name || user.username,
              message: message || undefined,
              accessToken: rawToken, // Use raw token for email link (never stored)
              dueDate: dueDate ? new Date(dueDate) : null
            });
          })
        );
      } catch (emailError) {
        console.error('Failed to send signature request emails:', emailError);
        // Don't fail the request if email fails
      }
      
      // Return packet with sanitized participants (no access tokens exposed)
      res.json({ ...packet, participants: createdParticipants.map(sanitizeParticipant) });
    } catch (error) {
      next(error);
    }
  });

  // Public: Get signing packet by access token (for signing page)
  app.get("/api/sign/:token", async (req, res, next) => {
    try {
      const participant = await storage.getSigningParticipantByToken(req.params.token);
      if (!participant) {
        return res.status(404).json({ message: "Invalid or expired signing link" });
      }
      
      const packet = await storage.getSigningPacket(participant.packetId);
      if (!packet) {
        return res.status(404).json({ message: "Signing packet not found" });
      }
      
      if (packet.status === 'cancelled') {
        return res.status(400).json({ message: "This signing request has been cancelled" });
      }
      
      if (packet.status === 'completed') {
        return res.status(400).json({ message: "This document has already been signed" });
      }
      
      // Mark as viewed if not already
      if (!participant.viewedAt) {
        await storage.updateSigningParticipant(participant.id, {
          viewedAt: new Date(),
          status: 'viewed'
        });
        await storage.createSigningEvent({
          packetId: packet.id,
          participantId: participant.id,
          eventType: 'viewed',
          actorName: participant.name,
          actorEmail: participant.email,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }
      
      // Get document info if available
      let document = null;
      if (packet.documentId) {
        document = await storage.getProjectDocument(packet.documentId);
      }
      
      // Get signing fields for this participant
      const allFields = await storage.getSigningFields(packet.id);
      const participantFields = allFields.filter(f => f.participantId === participant.id);
      
      res.json({
        packet: {
          id: packet.id,
          title: packet.title,
          message: packet.message,
          dueDate: packet.dueDate
        },
        participant: {
          id: participant.id,
          name: participant.name,
          email: participant.email,
          status: participant.status
        },
        document: document ? {
          name: document.name,
          fileUrl: document.fileUrl,
          mimeType: document.mimeType
        } : null,
        fields: participantFields.map(f => ({
          id: f.id,
          fieldType: f.fieldType,
          pageNumber: f.pageNumber,
          xPosition: f.xPosition,
          yPosition: f.yPosition,
          width: f.width,
          height: f.height,
          isRequired: f.isRequired,
          label: f.label
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Public: Submit signature
  app.post("/api/sign/:token", async (req, res, next) => {
    try {
      const { signatureData, signatureType } = req.body;
      
      if (!signatureData) {
        return res.status(400).json({ message: "Signature is required" });
      }
      
      const participant = await storage.getSigningParticipantByToken(req.params.token);
      if (!participant) {
        return res.status(404).json({ message: "Invalid or expired signing link" });
      }
      
      if (participant.status === 'signed') {
        return res.status(400).json({ message: "You have already signed this document" });
      }
      
      const packet = await storage.getSigningPacket(participant.packetId);
      if (!packet || packet.status === 'cancelled') {
        return res.status(400).json({ message: "This signing request is no longer valid" });
      }
      
      // Update participant with signature
      await storage.updateSigningParticipant(participant.id, {
        signatureData,
        signatureType: signatureType || 'drawn',
        signedAt: new Date(),
        status: 'signed',
        signerIp: req.ip,
        signerAgent: req.headers['user-agent']
      });
      
      // Create signed event
      await storage.createSigningEvent({
        packetId: packet.id,
        participantId: participant.id,
        eventType: 'signed',
        actorName: participant.name,
        actorEmail: participant.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: JSON.stringify({ signatureType: signatureType || 'drawn' })
      });
      
      // Check if all participants have signed
      const allParticipants = await storage.getSigningParticipants(packet.id);
      const allSigned = allParticipants.every(p => p.status === 'signed');
      
      if (allSigned) {
        await storage.updateSigningPacket(packet.id, {
          status: 'completed',
          completedAt: new Date()
        });
        await storage.createSigningEvent({
          packetId: packet.id,
          eventType: 'completed',
          actorName: 'System',
          metadata: JSON.stringify({ completedAt: new Date().toISOString() })
        });
        
        // Update the linked document's signature status to 'signed'
        if (packet.documentId) {
          await storage.updateProjectDocument(packet.documentId, {
            signatureStatus: 'signed'
          });
        }
      }
      
      // Send notification email to packet sender
      try {
        if (packet.createdById) {
          const sender = await storage.getUser(packet.createdById);
          if (sender?.email) {
            let projectName: string | undefined;
            if (packet.projectId) {
              const project = await storage.getProject(packet.projectId);
              projectName = project?.name;
            }
            
            const { sendSignatureCompletedEmail } = await import("./email");
            await sendSignatureCompletedEmail(sender.email, {
              senderName: sender.name || sender.username,
              signerName: participant.name,
              documentTitle: packet.title,
              isFullyComplete: allSigned,
              projectName
            });
          }
        }
      } catch (emailError) {
        console.error('Failed to send signature completion email:', emailError);
        // Don't fail the request if email fails
      }
      
      res.json({ 
        message: "Document signed successfully",
        allSigned
      });
    } catch (error) {
      next(error);
    }
  });

  // Get signing data for authenticated user (by packet ID)
  // This allows logged-in users to sign directly without needing the email token
  app.get("/api/signing-packets/:id/sign", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const packetId = req.params.id;
      
      const packet = await storage.getSigningPacket(packetId);
      if (!packet) {
        return res.status(404).json({ message: "Signing packet not found" });
      }
      
      if (packet.status === 'cancelled') {
        return res.status(400).json({ message: "This signing request has been cancelled" });
      }
      
      if (packet.status === 'completed') {
        return res.status(400).json({ message: "This document has already been signed" });
      }
      
      // Find participant by user's email
      const participants = await storage.getSigningParticipants(packetId);
      const participant = participants.find(p => p.email === user.email);
      
      if (!participant) {
        return res.status(403).json({ message: "You are not a signer for this document" });
      }
      
      if (participant.status === 'signed') {
        return res.status(400).json({ message: "You have already signed this document" });
      }
      
      // Mark as viewed if not already
      if (!participant.viewedAt) {
        await storage.updateSigningParticipant(participant.id, {
          viewedAt: new Date(),
          status: 'viewed'
        });
        await storage.createSigningEvent({
          packetId: packet.id,
          participantId: participant.id,
          eventType: 'viewed',
          actorName: participant.name,
          actorEmail: participant.email,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }
      
      // Get document info if available
      let document = null;
      if (packet.documentId) {
        document = await storage.getProjectDocument(packet.documentId);
      }
      
      // Get signing fields for this participant
      const allFields = await storage.getSigningFields(packet.id);
      const participantFields = allFields.filter(f => f.participantId === participant.id);
      
      res.json({
        packet: {
          id: packet.id,
          title: packet.title,
          message: packet.message,
          dueDate: packet.dueDate
        },
        participant: {
          id: participant.id,
          name: participant.name,
          email: participant.email,
          status: participant.status
        },
        document: document ? {
          name: document.name,
          fileUrl: document.fileUrl,
          mimeType: document.mimeType
        } : null,
        fields: participantFields.map(f => ({
          id: f.id,
          fieldType: f.fieldType,
          pageNumber: f.pageNumber,
          xPosition: f.xPosition,
          yPosition: f.yPosition,
          width: f.width,
          height: f.height,
          isRequired: f.isRequired,
          label: f.label
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Submit signature for authenticated user (by packet ID)
  app.post("/api/signing-packets/:id/sign", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const packetId = req.params.id;
      const { signatureData, signatureType, fieldCompletions } = req.body;
      
      if (!signatureData) {
        return res.status(400).json({ message: "Signature is required" });
      }
      
      const packet = await storage.getSigningPacket(packetId);
      if (!packet) {
        return res.status(404).json({ message: "Signing packet not found" });
      }
      
      if (packet.status === 'cancelled') {
        return res.status(400).json({ message: "This signing request has been cancelled" });
      }
      
      if (packet.status === 'completed') {
        return res.status(400).json({ message: "This document has already been signed" });
      }
      
      // Find participant by user's email
      const participants = await storage.getSigningParticipants(packetId);
      const participant = participants.find(p => p.email === user.email);
      
      if (!participant) {
        return res.status(403).json({ message: "You are not a signer for this document" });
      }
      
      if (participant.status === 'signed') {
        return res.status(400).json({ message: "You have already signed this document" });
      }
      
      // Save field completion values
      if (fieldCompletions && typeof fieldCompletions === 'object') {
        for (const [fieldId, completion] of Object.entries(fieldCompletions)) {
          const comp = completion as { value: string; fieldType: string };
          if (comp.value) {
            await storage.updateSigningField(fieldId, { value: comp.value });
          }
        }
      }
      
      // Update participant as signed
      await storage.updateSigningParticipant(participant.id, {
        status: 'signed',
        signedAt: new Date(),
        signatureData,
        signatureType: signatureType || 'drawn'
      });
      
      // Record signing event
      await storage.createSigningEvent({
        packetId: packet.id,
        participantId: participant.id,
        eventType: 'signed',
        actorName: participant.name,
        actorEmail: participant.email,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      // Check if all participants have signed
      const allParticipants = await storage.getSigningParticipants(packet.id);
      const allSigned = allParticipants.every(p => p.status === 'signed');
      
      if (allSigned) {
        await storage.updateSigningPacket(packet.id, { 
          status: 'completed',
          completedAt: new Date()
        });
        await storage.createSigningEvent({
          packetId: packet.id,
          eventType: 'completed',
          actorName: 'System',
          metadata: JSON.stringify({ allParticipantsSigned: true })
        });
        
        // Generate stamped PDF with all signatures
        if (packet.documentId) {
          try {
            const document = await storage.getProjectDocument(packet.documentId);
            if (document?.fileUrl && document.mimeType === 'application/pdf') {
              const { stampPdfWithSignatures, fetchPdfFromUrl } = await import("./pdf-stamper");
              const signingFields = await storage.getSigningFields(packet.id);
              
              // Fetch original PDF
              const pdfBytes = await fetchPdfFromUrl(document.fileUrl);
              
              // Stamp signatures and fields onto PDF
              const stampedPdf = await stampPdfWithSignatures(pdfBytes, signingFields, allParticipants);
              
              // Upload stamped PDF to object storage
              const { ObjectStorageService } = await import("./replit_integrations/object_storage");
              const objectStorage = new ObjectStorageService();
              const { uploadUrl, objectPath } = await objectStorage.getObjectEntityUploadURLWithPath();
              
              // Upload the stamped PDF
              const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: stampedPdf,
                headers: { 'Content-Type': 'application/pdf' }
              });
              
              if (uploadResponse.ok) {
                // Set ACL to allow access (public visibility for project files)
                try {
                  await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
                    owner: packet.createdById || 'system',
                    visibility: 'public'
                  });
                } catch (aclError) {
                  console.error('Failed to set ACL on stamped PDF:', aclError);
                }
                
                // Update document with new file URL and rename to indicate signed
                const originalName = document.name || 'document.pdf';
                const signedName = originalName.replace(/\.pdf$/i, '') + ' (Signed).pdf';
                
                await storage.updateProjectDocument(packet.documentId, {
                  signatureStatus: 'signed',
                  fileUrl: objectPath,
                  name: signedName
                });
                console.log('Stamped PDF saved successfully:', objectPath);
              } else {
                console.error('Failed to upload stamped PDF:', uploadResponse.status);
                // Still mark as signed even if stamping failed
                const originalName = document.name || 'document.pdf';
                const signedName = originalName.replace(/\.pdf$/i, '') + ' (Signed).pdf';
                await storage.updateProjectDocument(packet.documentId, {
                  signatureStatus: 'signed',
                  name: signedName
                });
              }
            } else {
              // Non-PDF document, just mark as signed
              await storage.updateProjectDocument(packet.documentId, {
                signatureStatus: 'signed'
              });
            }
          } catch (stampError) {
            console.error('Error generating stamped PDF:', stampError);
            // Still mark as signed even if stamping failed
            await storage.updateProjectDocument(packet.documentId, {
              signatureStatus: 'signed'
            });
          }
        }
      }
      
      // Send notification email to packet sender
      try {
        if (packet.createdById) {
          const sender = await storage.getUser(packet.createdById);
          if (sender?.email) {
            let projectName: string | undefined;
            if (packet.projectId) {
              const project = await storage.getProject(packet.projectId);
              projectName = project?.name;
            }
            
            const { sendSignatureCompletedEmail } = await import("./email");
            await sendSignatureCompletedEmail(sender.email, {
              senderName: sender.name || sender.username,
              signerName: participant.name,
              documentTitle: packet.title,
              isFullyComplete: allSigned,
              projectName
            });
          }
        }
      } catch (emailError) {
        console.error('Failed to send signature completion email:', emailError);
      }
      
      res.json({ 
        message: "Document signed successfully",
        allSigned
      });
    } catch (error) {
      next(error);
    }
  });

  // Cancel a signing packet
  app.post("/api/signing-packets/:id/cancel", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const packet = await storage.getSigningPacket(req.params.id);
      
      if (!packet) {
        return res.status(404).json({ message: "Signing packet not found" });
      }
      
      if (packet.status === 'completed') {
        return res.status(400).json({ message: "Cannot cancel a completed signing request" });
      }
      
      await storage.updateSigningPacket(req.params.id, { status: 'cancelled' });
      await storage.createSigningEvent({
        packetId: packet.id,
        eventType: 'cancelled',
        actorName: user.name || user.username,
        actorEmail: user.email || undefined
      });
      
      res.json({ message: "Signing request cancelled" });
    } catch (error) {
      next(error);
    }
  });

  // Register object storage routes
  registerObjectStorageRoutes(app);

  // Serve objects from GCS object storage (requires authentication and project access)
  app.get("/objects/*", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const user = req.user as User;
      const objectPath = req.path;
      const objectStorage = new ObjectStorageService();
      const file = await objectStorage.getObjectEntityFile(objectPath);
      
      // Find the document associated with this file path to verify project access
      const document = await storage.getProjectDocumentByFileUrl(objectPath);
      
      if (document) {
        // Verify user has access to the project
        const project = await storage.getProject(document.projectId);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        
        // Check if user is project client, contractor, admin, or notary with access to notarization docs
        const hasAccess = 
          user.role === 'admin' || 
          user.role === 'notary' ||
          project.clientId === user.id || 
          project.contractorId === user.id;
        
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
        
        // Set the Content-Disposition header with the document's display name
        const filename = encodeURIComponent(document.name);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      } else {
        // If no document found, check ACL or deny access
        const canAccess = await objectStorage.canAccessObjectEntity({
          userId: user.id,
          objectFile: file,
        });
        
        if (!canAccess) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      await objectStorage.downloadObject(file, res);
    } catch (error: any) {
      if (error.name === 'ObjectNotFoundError') {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Error serving object:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error serving object" });
      }
    }
  });

  // Update user profile (phone, email, name)
  app.patch("/api/user/profile", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { phone, email, name } = req.body;
      
      const updates: Partial<{ phone: string; email: string; name: string }> = {};
      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email;
      if (name !== undefined) updates.name = name;
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }
      
      const updatedUser = await storage.updateUser(user.id, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      next(error);
    }
  });

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

  // SharePoint backup routes (admin/contractor only)
  app.post("/api/projects/:id/backup", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== 'admin' && user.role !== 'contractor' && user.role !== 'company_owner') {
        return res.status(403).json({ message: "Only contractors and admins can trigger backups" });
      }
      
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Enforce company-scoped project access — prevents cross-tenant backup trigger
      if (!(await canAccessProject(user, project))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      console.log(`[Backup] Manual backup triggered for project ${project.id} by ${user.username}`);
      const result = await createProjectBackup(project.id);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Backup created successfully with ${result.uploadedFiles} files`,
          clientPackagePath: result.clientPackagePath,
          pmPackagePath: result.pmPackagePath
        });
      } else {
        res.json({
          success: false,
          message: "Backup completed with some errors",
          uploadedFiles: result.uploadedFiles,
          errors: result.errors
        });
      }
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
