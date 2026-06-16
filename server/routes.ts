import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { sendDemoRequestEmail, sendPasswordResetEmail } from "./email";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pkg from "pg";
const { Pool } = pkg;
import type { User, InsertUser, Company, InsertCompany, Project, InsertProject, InsertEstimate, InsertEstimateLineItem, InsertInvoice, InsertInvoiceLineItem, InsertRecurringBilling, InsertProjectPhase, InsertActionItem, InsertInspirationImage, InsertMessage, ExternalMemberPermissions, ContractorInvite, ProjectInvite } from "@shared/schema";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
import { createProjectBackup, shouldTriggerBackup } from "./backup-service";
import { runRoleMigration } from "./migrate-roles";
import { seedTestAccounts } from "./seed-test-accounts";
import { setupWebSocket, broadcast } from "./websocket";
import { logAuditEvent } from "./auditLog";
import { getStripe, getStripePublishableKey, isStripeConfigured, getStripeWebhookSecret } from "./stripe";

const PgSession = connectPgSimple(session);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes of inactivity
const HARD_CAP_MS = 2 * 60 * 60 * 1000;         // 2-hour absolute maximum

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

  // Global View-As timeout enforcement: runs on every authenticated request after
  // passport deserializes the session. Enforces 30-min inactivity + 2-hr hard cap.
  // IMPORTANT: expiry is checked BEFORE lastActivityAt is updated so that inactivity
  // on a stale session is never masked by a same-request refresh.
  app.use(async (req: any, res, next) => {
    const session = req.session as any;
    if (!req.isAuthenticated() || !session.adminData?.userId) return next();

    // Step 1: read timing data
    const { userId: adminId, startedAt = 0, lastActivityAt } = session.adminData;
    const now = Date.now();
    const lastActivity = lastActivityAt ?? startedAt;

    // Step 2: check expiry (inactivity OR hard cap) — before any writes
    const inactivityExpired = (now - lastActivity) > INACTIVITY_TIMEOUT_MS;
    const hardCapExpired = (now - startedAt) > HARD_CAP_MS;

    if (inactivityExpired || hardCapExpired) {
      // Step 3: expire — log audit event, restore admin, clear session data
      const viewedUser = req.user as User;
      try {
        const adminUser = await storage.getUser(adminId);
        if (adminUser && viewedUser) {
          const endedAt = now;
          const durationMs = endedAt - startedAt;
          logAuditEvent(req, adminUser, {
            action: "view_as_ended",
            entityType: "user",
            entityId: viewedUser.id,
            entityName: viewedUser.name ?? viewedUser.username,
            companyId: viewedUser.companyId ?? null,
            metadata: {
              endReason: "timeout",
              viewedUserId: viewedUser.id,
              viewedUserEmail: viewedUser.email,
              viewedUserRole: viewedUser.role,
              viewedUserName: viewedUser.name ?? viewedUser.username,
              startedAt,
              endedAt,
              durationMs,
            },
          });
        }
        delete session.adminData;
        if (adminUser) {
          await new Promise<void>((resolve) => {
            req.logIn(adminUser, { session: true, keepSessionInfo: true }, () => resolve());
          });
        }
        session.viewAsExpired = true;
      } catch {
        delete session.adminData;
      }
      return next();
    }

    // Step 4: not expired — update lastActivityAt now (after the expiry check)
    session.adminData.lastActivityAt = now;
    next();
  });

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

  // Public contact / demo request route
  app.post("/api/contact", async (req, res, next) => {
    try {
      const contactSchema = z.object({
        name: z.string().min(1, "Name is required"),
        company: z.string().optional().default(""),
        email: z.string().email("Valid email is required"),
        phone: z.string().optional().default(""),
        message: z.string().optional().default(""),
      });
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { name, company, email, phone, message } = parsed.data;
      // Persist to DB first — fail request if DB save fails so no leads are silently lost
      const saved = await storage.createDemoRequest({ name, company, email, phone, message, status: "new", hubspotSyncStatus: "not_configured" });
      // Email notification is best-effort
      try {
        await sendDemoRequestEmail({ name, company, email, phone, message });
      } catch (emailErr) {
        console.error("Failed to send demo request notification email:", emailErr);
      }
      // HubSpot sync — best-effort, scoped exclusively to demo requests (see server/hubspot.ts).
      // When HUBSPOT_ACCESS_TOKEN is absent: syncDemoRequestToHubSpot() returns {status:"not_configured"},
      // no HubSpot API is called, and hubspotSyncStatus stays "not_configured" in the database.
      // The public response is always the same success message regardless of sync outcome.
      if (process.env.HUBSPOT_ACCESS_TOKEN?.trim()) {
        // Mark pending immediately so the admin UI reflects in-progress state
        storage.updateDemoRequest(saved.id, { hubspotSyncStatus: "pending" }).catch(() => {});
      }
      (async () => {
        try {
          const { syncDemoRequestToHubSpot } = await import("./hubspot");
          const syncResult = await syncDemoRequestToHubSpot(saved);
          // Only write back when we actually attempted a sync (token was configured)
          if (syncResult.status !== "not_configured") {
            await storage.updateDemoRequest(saved.id, {
              hubspotSyncStatus: syncResult.status,
              hubspotContactId: syncResult.contactId ?? saved.hubspotContactId,
              hubspotCompanyId: syncResult.companyId ?? saved.hubspotCompanyId,
              hubspotDealId: syncResult.dealId ?? saved.hubspotDealId,
              hubspotLastSyncedAt: syncResult.status === "synced" ? new Date() : saved.hubspotLastSyncedAt,
              hubspotSyncError: syncResult.status === "failed" ? (syncResult.error ?? null) : null,
            });
          }
        } catch (hubErr) {
          // Log for server-side visibility only; never surfaced to the public user
          console.error("HubSpot sync error (non-fatal):", hubErr);
        }
      })();
      res.json({ success: true, message: "Thanks — your demo request has been sent. Our team will reach out soon." });
    } catch (err) {
      console.error("Contact form error:", err);
      res.status(502).json({ error: "Failed to send your request. Please try again or email us directly." });
    }
  });

  // Auth routes
  // PUBLIC_REGISTRATION_ENABLED: set to true to re-open self-registration.
  // While false, all direct POST requests are rejected — invite-based creation
  // via /api/invites/:token/accept and /api/contractor-invites/accept/:token is unaffected.
  const PUBLIC_REGISTRATION_ENABLED = false;

  app.post("/api/auth/register", async (req, res, next) => {
    if (!PUBLIC_REGISTRATION_ENABLED) {
      return res.status(403).json({ message: "Public registration is disabled. Please use an invitation link." });
    }
    try {
      const { username, email, password, role, name, companyName, companyType, phone, contractorType } = req.body;
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Only client and contractor (subcontractor|notary) may self-register.
      // company_owner and admin accounts are created by admins after a demo.
      const isAllowedPublicRole = role === "client" || role === "contractor";
      if (!isAllowedPublicRole) {
        return res.status(400).json({
          message: "Company accounts are created through our onboarding process. Please request a demo to get started.",
        });
      }
      const isAllowedContractorSubtype = contractorType === "subcontractor" || contractorType === "notary";
      const hasContractorSubtype = role === "contractor" && isAllowedContractorSubtype;
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

      // Disabled accounts cannot log in — return 401 distinct from auth failure (400)
      if ((user as User).isDisabled) {
        return res.status(401).json({ message: "This account has been disabled. Please contact support." });
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
      
      req.login(user, { session: true, keepSessionInfo: true } as any, (err) => {
        if (err) {
          return next(err);
        }
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ user: userWithoutPassword, portal });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", async (req, res) => {
    const session = req.session as any;

    // If a View As session is active, write a view_as_ended audit event before
    // logging out. Best-effort — any error is swallowed so logout always succeeds.
    if (req.isAuthenticated() && session.adminData?.userId) {
      const viewedUser = req.user as User;
      const { userId: adminId, startedAt = Date.now() } = session.adminData;
      try {
        const adminUser = await storage.getUser(adminId);
        if (adminUser && viewedUser) {
          const endedAt = Date.now();
          logAuditEvent(req, adminUser, {
            action: "view_as_ended",
            entityType: "user",
            entityId: viewedUser.id,
            entityName: viewedUser.name ?? viewedUser.username,
            companyId: viewedUser.companyId ?? null,
            metadata: {
              endReason: "logout",
              viewedUserId: viewedUser.id,
              viewedUserEmail: viewedUser.email,
              viewedUserRole: viewedUser.role,
              viewedUserName: viewedUser.name ?? viewedUser.username,
              startedAt,
              endedAt,
              durationMs: endedAt - startedAt,
            },
          });
        }
      } catch {
        // best-effort — continue to logout regardless of audit failure
      }
      delete session.adminData;
      delete session.viewAsExpired;
    }

    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as User;
      const { password: _, ...userWithoutPassword } = user;
      const session = req.session as any;

      // If the global timeout middleware just expired a view-as session, relay
      // that to the client as a one-time flag so it can show a toast.
      if (session.viewAsExpired) {
        delete session.viewAsExpired;
        return res.json({ user: userWithoutPassword, viewAsAdmin: null, viewAsExpired: true });
      }

      // Include viewAsAdmin context when a view-as session is active
      let viewAsAdmin = null;
      if (session.adminData?.userId) {
        const adminUser = await storage.getUser(session.adminData.userId);
        if (adminUser) {
          const { password: __, ...adminWithoutPassword } = adminUser;
          viewAsAdmin = adminWithoutPassword;
        }
      }
      return res.json({ user: userWithoutPassword, viewAsAdmin });
    }
    res.status(401).json({ message: "Not authenticated" });
  });

  // Forgot password — send a reset link via email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        // Always return 200 to avoid email enumeration
        return res.json({ message: "If that email exists, a reset link has been sent." });
      }
      const { email } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (user) {
        // Invalidate any existing unused tokens for this user
        await storage.invalidateUserPasswordResetTokens(user.id);

        // Generate a secure random token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await storage.createPasswordResetToken(user.id, tokenHash, expiresAt);

        // Send the email (best-effort — don't fail the request if email fails)
        sendPasswordResetEmail(email, { userName: user.name ?? undefined, resetToken: rawToken })
          .catch((err) => console.error("[forgot-password] Email send failed:", err));
      }
      // Always return the same response regardless of whether user exists
      res.json({ message: "If that email exists, a reset link has been sent." });
    } catch (err) {
      console.error("[forgot-password] Error:", err);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    }
  });

  // Validate a password reset token (GET)
  app.get("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const record = await storage.getPasswordResetToken(tokenHash);
      if (!record || record.usedAt || new Date() > record.expiresAt) {
        return res.status(400).json({ message: "This reset link is invalid or has expired." });
      }
      res.json({ valid: true });
    } catch (err) {
      console.error("[reset-password GET] Error:", err);
      res.status(500).json({ message: "Something went wrong." });
    }
  });

  // Consume a password reset token and update the password (POST)
  app.post("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const bodySchema = z.object({ password: z.string().min(8) });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Atomically consume the token — marks used_at only if token is valid, unused, and unexpired
      const record = await storage.consumePasswordResetToken(tokenHash);
      if (!record) {
        return res.status(400).json({ message: "This reset link is invalid or has expired." });
      }

      const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
      await storage.updateUserPassword(record.userId, hashedPassword);

      res.json({ message: "Password updated successfully." });
    } catch (err) {
      console.error("[reset-password POST] Error:", err);
      res.status(500).json({ message: "Something went wrong." });
    }
  });

  // Admin-only middleware
  const ACTIVE_STATUSES = new Set(["active", "prepaid", "free"]);

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
    // Only active, prepaid, or free companies may perform write operations
    if (ACTIVE_STATUSES.has(company.subscriptionStatus ?? "")) return next();
    return res.status(402).json({
      message: "Your company access is not active. Please contact support to update your Billing & Access status.",
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
      path.startsWith("/api/sandbox") ||
      // Stripe webhook — verified by signature, must not be blocked by subscription check
      path === "/api/stripe/webhook"
    ) {
      return next();
    }
    return requireActiveSubscription(req, res, next);
  });

  // ── Stripe routes ──────────────────────────────────────────────────────────
  //
  // POST /api/stripe/webhook
  // Receives Stripe webhook events. Verified via HMAC signature.
  // Raw body is available as req.rawBody (captured in server/index.ts via verify callback).
  // Path is in the write-middleware allowlist so subscription-blocked companies do not
  // accidentally 400-out legitimate Stripe callbacks.
  //
  // Phase 10A: logs events and verifies signatures. All business handlers are TODO
  // for Phase 10B — no company access mutations happen here yet.
  app.post("/api/stripe/webhook", async (req: any, res: any) => {
    const sig = req.headers["stripe-signature"] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const webhookSecret = getStripeWebhookSecret();
    const stripe = getStripe();

    if (!webhookSecret) {
      // Webhook secret not configured — reject the request rather than accepting unsigned payloads.
      // This enforces the policy that all webhook traffic must pass signature verification.
      console.warn("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set; rejecting unsigned request.");
      return res.status(503).json({ error: "Webhook endpoint not configured" });
    }

    if (!stripe) {
      console.error("[stripe/webhook] Stripe SDK not initialised (missing STRIPE_SECRET_KEY).");
      return res.status(500).json({ error: "Stripe not configured" });
    }

    if (!sig || !rawBody) {
      return res.status(400).json({ error: "Missing stripe-signature header or raw body" });
    }

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[stripe/webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    console.info(`[stripe/webhook] Received event: ${event.type} (id: ${event.id})`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // TODO (Phase 10B): update company stripeSubscriptionId, stripePaymentStatus,
        // stripeCurrentPeriodEnd, and subscriptionStatus based on subscription.status.
        // IMPORTANT: map Stripe's "canceled" (one L) → internal "cancelled" (two L's).
        break;

      case "invoice.paid":
        // TODO (Phase 10B): clear stripePaymentStatus to "current", reset grace period fields,
        // update lastStripeInvoiceId.
        break;

      case "invoice.payment_failed":
        // TODO (Phase 10B): set stripePaymentStatus to "past_due", record
        // lastPaymentFailureAt / lastPaymentFailureReason, set stripeGraceStartedAt
        // and stripeGraceEndsAt (e.g. now + 3 days).
        break;

      case "invoice.payment_action_required":
        // TODO (Phase 10B): set stripePaymentStatus to "action_required".
        break;

      case "checkout.session.completed":
        // TODO (Phase 10B): link newly created Stripe customer/subscription IDs to the
        // company record, set stripeCustomerId, stripeSubscriptionId, stripePriceId,
        // and transition subscriptionStatus to "active".
        break;

      default:
        // Log unhandled event types so nothing is silently swallowed.
        console.info(`[stripe/webhook] Unhandled event type: ${event.type} (id: ${event.id})`);
        break;
    }

    return res.status(200).json({ received: true });
  });

  // GET /api/stripe/config
  // Returns the Stripe publishable key for use in the frontend.
  // NEVER returns STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, or any other secret.
  // Auth required; only company_owner or regular isCompanyAdmin contractors.
  // Subcontractors and notaries are explicitly denied even if isCompanyAdmin is set.
  app.get("/api/stripe/config", async (req: any, res: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as any;
    // Subcontractors and notaries must never access Stripe config regardless of isCompanyAdmin
    const isBlockedContractorSubtype =
      user.contractorType === "subcontractor" || user.contractorType === "notary";
    const isOwnerOrAdmin =
      user.role === "company_owner" ||
      (user.role === "contractor" && user.isCompanyAdmin && !isBlockedContractorSubtype);
    if (!isOwnerOrAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return res.json({
      configured: isStripeConfigured(),
      publishableKey: getStripePublishableKey() ?? null,
    });
  });

  // ── End Stripe routes ───────────────────────────────────────────────────────

  // GET /api/company/financial-activity
  // Company-scoped financial audit feed (estimate_created, invoice_created, invoice_updated).
  // Allowed: company_owner, isCompanyAdmin contractors (not subcontractor/notary subtypes).
  // Blocked: clients, subcontractors, notaries, unauthenticated users.
  app.get("/api/company/financial-activity", async (req: any, res: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as any;
    const isBlockedSubtype =
      user.contractorType === "subcontractor" || user.contractorType === "notary";
    const isAllowed =
      user.role === "company_owner" ||
      (user.role === "contractor" && user.isCompanyAdmin && !isBlockedSubtype);
    if (!isAllowed) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (!user.companyId) {
      return res.status(403).json({ message: "No company associated with this account" });
    }
    try {
      const ACTION_LABELS: Record<string, string> = {
        estimate_created: "Estimate Created",
        invoice_created: "Invoice Created",
        invoice_updated: "Invoice Updated",
      };
      const rows = await storage.listCompanyFinancialActivity(user.companyId, 10);
      const items = rows.map((r) => {
        const meta = (r.metadata ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          action: r.action,
          label: ACTION_LABELS[r.action] ?? r.action,
          actorName: r.actorName,
          entityType: r.entityType,
          entityName: r.entityName ?? null,
          projectId: r.projectId ?? null,
          projectName: typeof meta.projectName === "string" ? meta.projectName : null,
          amount: meta.amount !== undefined ? meta.amount : null,
          status: typeof meta.status === "string" ? meta.status : null,
          dueDate: typeof meta.dueDate === "string" ? meta.dueDate : null,
          createdAt: r.createdAt,
        };
      });
      return res.json(items);
    } catch (err) {
      console.error("[financial-activity]", err);
      return res.status(500).json({ message: "Failed to load financial activity" });
    }
  });

  // ── Expense Routes ────────────────────────────────────────────────────────────
  // Access control:
  //   READ  — company_owner, isCompanyAdmin contractor, regular internal contractor
  //           (contractorType=null, companyId set)
  //   WRITE — company_owner, isCompanyAdmin contractor only
  //   BLOCKED always — client, subcontractor, notary, any user with no companyId
  //                    (includes Super Admin whose role='admin' but has no companyId)

  function expenseReadAccess(req: any, res: any): { user: any; allowed: boolean } {
    const user = req.user as any;
    if (!user.companyId) return { user, allowed: false };
    if (user.role === "client") return { user, allowed: false };
    if (user.contractorType === "subcontractor" || user.contractorType === "notary") return { user, allowed: false };
    const isOwner = user.role === "company_owner";
    const isAdmin = user.isCompanyAdmin === true && user.role === "contractor";
    const isInternalMember = user.role === "contractor" && !user.contractorType && !!user.companyId;
    return { user, allowed: isOwner || isAdmin || isInternalMember };
  }

  function expenseWriteAccess(req: any, res: any): { user: any; allowed: boolean } {
    const user = req.user as any;
    if (!user.companyId) return { user, allowed: false };
    if (user.role === "client") return { user, allowed: false };
    if (user.contractorType === "subcontractor" || user.contractorType === "notary") return { user, allowed: false };
    const isOwner = user.role === "company_owner";
    const isAdmin = user.isCompanyAdmin === true && user.role === "contractor";
    return { user, allowed: isOwner || isAdmin };
  }

  app.get("/api/company/expenses", requireAuth, async (req: any, res: any) => {
    const { user, allowed } = expenseReadAccess(req, res);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });
    const { projectId, category, status, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    try {
      const rows = await storage.getExpenses(user.companyId, {
        projectId: projectId || undefined,
        category: category || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      return res.json(rows);
    } catch (err) {
      console.error("[expenses:GET]", err);
      return res.status(500).json({ message: "Failed to load expenses" });
    }
  });

  app.post("/api/company/expenses", requireAuth, requireActiveSubscription, async (req: any, res: any) => {
    const { user, allowed } = expenseWriteAccess(req, res);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const bodySchema = z.object({
      category: z.string().min(1, "Category is required"),
      description: z.string().min(1, "Description is required"),
      amount: z.string().refine((v) => isFinite(parseFloat(v)) && parseFloat(v) > 0, "Amount must be a positive number"),
      expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
      vendorName: z.string().optional().nullable(),
      projectId: z.string().optional().nullable(),
      budgetItemId: z.string().optional().nullable(),
      paymentMethod: z.string().optional().nullable(),
      status: z.string().optional(),
      notes: z.string().optional().nullable(),
      receiptUrl: z.string().optional().nullable(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const data = parsed.data;

    // Validate expenseDate is a real calendar date (not just format)
    const parsedDatePost = new Date(data.expenseDate + "T00:00:00");
    if (isNaN(parsedDatePost.getTime()) || parsedDatePost.toISOString().slice(0, 10) !== data.expenseDate) {
      return res.status(400).json({ message: "expenseDate is not a valid calendar date" });
    }

    // Validate paymentMethod against allowed values
    const { EXPENSE_PAYMENT_METHODS: PM_POST, EXPENSE_STATUSES } = await import("@shared/schema");
    if (data.paymentMethod && !PM_POST.includes(data.paymentMethod as any)) {
      return res.status(400).json({ message: `Invalid payment method: ${data.paymentMethod}` });
    }

    if (data.projectId) {
      const companyProjects = await storage.getProjectsByCompanyId(user.companyId);
      if (!companyProjects.some((p) => p.id === data.projectId)) {
        return res.status(403).json({ message: "Project not found or does not belong to your company" });
      }
    }
    const statusVal = data.status ?? "pending";
    if (!EXPENSE_STATUSES.includes(statusVal as any)) {
      return res.status(400).json({ message: `Invalid status: ${statusVal}` });
    }

    // Validate budgetItemId — requires projectId, same company, same project
    if (data.budgetItemId) {
      if (!data.projectId) {
        return res.status(400).json({ message: "projectId is required when budgetItemId is set" });
      }
      const budgetItem = await storage.getProjectBudgetItemById(data.budgetItemId);
      if (!budgetItem) return res.status(404).json({ message: "Budget item not found" });
      if (budgetItem.companyId !== user.companyId) {
        return res.status(403).json({ message: "Budget item belongs to another company" });
      }
      if (budgetItem.projectId !== data.projectId) {
        return res.status(400).json({ message: "Budget item does not belong to the selected project" });
      }
    }

    try {
      const expense = await storage.createExpense({
        companyId: user.companyId,
        projectId: data.projectId ?? null,
        budgetItemId: data.budgetItemId ?? null,
        vendorName: data.vendorName ?? null,
        category: data.category,
        description: data.description,
        amount: data.amount,
        expenseDate: data.expenseDate,
        paymentMethod: data.paymentMethod ?? null,
        receiptUrl: data.receiptUrl ?? null,
        status: statusVal,
        notes: data.notes ?? null,
        createdById: user.id,
        createdByName: user.name ?? user.username,
      });

      // Recalculate actual totals if expense is linked to a budget item
      if (expense.budgetItemId) {
        await storage.recalculateItemActualTotal(expense.budgetItemId);
        const linkedItem = await storage.getProjectBudgetItemById(expense.budgetItemId);
        if (linkedItem?.budgetId) {
          await storage.recalculateBudgetActualTotal(linkedItem.budgetId);
        }
      }

      return res.status(201).json(expense);
    } catch (err) {
      console.error("[expenses:POST]", err);
      return res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.patch("/api/company/expenses/:id", requireAuth, requireActiveSubscription, async (req: any, res: any) => {
    const { user, allowed } = expenseWriteAccess(req, res);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const existing = await storage.getExpense(req.params.id);
    if (!existing) return res.status(404).json({ message: "Expense not found" });
    if (existing.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });

    const bodySchema = z.object({
      category: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      amount: z.string().refine((v) => isFinite(parseFloat(v)) && parseFloat(v) > 0, "Amount must be a positive number").optional(),
      expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      vendorName: z.string().nullable().optional(),
      projectId: z.string().nullable().optional(),
      budgetItemId: z.string().nullable().optional(),
      paymentMethod: z.string().nullable().optional(),
      status: z.string().optional(),
      notes: z.string().nullable().optional(),
      receiptUrl: z.string().nullable().optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const data = parsed.data;

    // Validate expenseDate is a real calendar date when provided
    if (data.expenseDate) {
      const parsedDatePatch = new Date(data.expenseDate + "T00:00:00");
      if (isNaN(parsedDatePatch.getTime()) || parsedDatePatch.toISOString().slice(0, 10) !== data.expenseDate) {
        return res.status(400).json({ message: "expenseDate is not a valid calendar date" });
      }
    }

    const { EXPENSE_PAYMENT_METHODS: PM_PATCH, EXPENSE_STATUSES } = await import("@shared/schema");

    // Validate paymentMethod against allowed values when provided
    if (data.paymentMethod && !PM_PATCH.includes(data.paymentMethod as any)) {
      return res.status(400).json({ message: `Invalid payment method: ${data.paymentMethod}` });
    }

    if (data.projectId) {
      const companyProjects = await storage.getProjectsByCompanyId(user.companyId);
      if (!companyProjects.some((p) => p.id === data.projectId)) {
        return res.status(403).json({ message: "Project not found or does not belong to your company" });
      }
    }

    if (data.status) {
      if (!EXPENSE_STATUSES.includes(data.status as any)) {
        return res.status(400).json({ message: `Invalid status: ${data.status}` });
      }
    }

    // Determine the projectId this expense will have after saving
    const incomingProjectId = data.projectId !== undefined ? data.projectId : existing.projectId;

    const oldBudgetItemId = existing.budgetItemId ?? null;
    let finalBudgetItemId: string | null;
    const projectIdChanging = data.projectId !== undefined && data.projectId !== existing.projectId;

    if (projectIdChanging) {
      // Project is changing — any existing link to a budget item is now stale.
      // Force-clear UNLESS the caller explicitly provides a DIFFERENT budgetItemId
      // (i.e. they are relinking to an item in the new project in the same request).
      const explicitNewItem =
        data.budgetItemId !== undefined &&
        data.budgetItemId !== null &&
        data.budgetItemId !== oldBudgetItemId;
      finalBudgetItemId = explicitNewItem ? data.budgetItemId! : null;
    } else if (data.budgetItemId !== undefined) {
      finalBudgetItemId = data.budgetItemId;
    } else {
      finalBudgetItemId = oldBudgetItemId;
    }

    // Validate finalBudgetItemId whenever it is non-null AND:
    //   - it differs from the old value, OR
    //   - the projectId is changing (re-verify item still belongs to the resolved project)
    if (finalBudgetItemId && (finalBudgetItemId !== oldBudgetItemId || projectIdChanging)) {
      if (!incomingProjectId) {
        return res.status(400).json({ message: "projectId is required when budgetItemId is set" });
      }
      const budgetItem = await storage.getProjectBudgetItemById(finalBudgetItemId);
      if (!budgetItem) return res.status(404).json({ message: "Budget item not found" });
      if (budgetItem.companyId !== user.companyId) {
        return res.status(403).json({ message: "Budget item belongs to another company" });
      }
      if (budgetItem.projectId !== incomingProjectId) {
        return res.status(400).json({ message: "Budget item does not belong to the selected project" });
      }
    }

    try {
      // Build explicit update payload so auto-cleared budgetItemId is always persisted
      const updatePayload: Record<string, any> = { ...data };
      updatePayload.budgetItemId = finalBudgetItemId;

      const updated = await storage.updateExpense(req.params.id, updatePayload as any);

      // Determine which budget items need recalculation
      const amountChanged = data.amount !== undefined && data.amount !== existing.amount;
      const statusChanged = data.status !== undefined && data.status !== existing.status;
      const budgetItemIdChanged = finalBudgetItemId !== oldBudgetItemId;

      const affectedItemIds: string[] = [];
      if (oldBudgetItemId && budgetItemIdChanged) {
        affectedItemIds.push(oldBudgetItemId);
      }
      if (finalBudgetItemId && (budgetItemIdChanged || amountChanged || statusChanged)) {
        if (!affectedItemIds.includes(finalBudgetItemId)) {
          affectedItemIds.push(finalBudgetItemId);
        }
      }

      const affectedBudgetIds = new Set<string>();
      for (const itemId of affectedItemIds) {
        await storage.recalculateItemActualTotal(itemId);
        const item = await storage.getProjectBudgetItemById(itemId);
        if (item?.budgetId) affectedBudgetIds.add(item.budgetId);
      }
      for (const budgetId of affectedBudgetIds) {
        await storage.recalculateBudgetActualTotal(budgetId);
      }

      return res.json(updated);
    } catch (err) {
      console.error("[expenses:PATCH]", err);
      return res.status(500).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/company/expenses/:id", requireAuth, requireActiveSubscription, async (req: any, res: any) => {
    const { user, allowed } = expenseWriteAccess(req, res);
    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const existing = await storage.getExpense(req.params.id);
    if (!existing) return res.status(404).json({ message: "Expense not found" });
    if (existing.companyId !== user.companyId) return res.status(403).json({ message: "Forbidden" });

    try {
      await storage.deleteExpense(req.params.id);
      return res.status(204).send();
    } catch (err) {
      console.error("[expenses:DELETE]", err);
      return res.status(500).json({ message: "Failed to delete expense" });
    }
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

  // Read-only access for internal company members (used for price book GET routes).
  // Passes for: company_owner, regular internal contractors (companyId set, no
  // subcontractor/notary contractorType), isCompanyAdmin contractors, and admin.
  // Blocks: clients, subcontractors, notaries, unauthenticated users.
  const requireInternalCompanyMember = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as User;
    if (user.role === "admin") return next();
    if (user.role === "company_owner") return next();
    if (
      user.role === "contractor" &&
      user.companyId &&
      user.contractorType !== "subcontractor" &&
      user.contractorType !== "notary"
    ) return next();
    return res.status(403).json({ message: "Internal company member access required" });
  };

  // Transport-layer guard for estimate routes (GET /api/estimates, GET /api/estimates/:id,
  // POST /api/estimates). Blocks clients, subcontractors, notaries, and users without a
  // companyId (except platform admin) before any DB work is performed.
  // Allowed: admin, company_owner (with companyId), isCompanyAdmin contractors,
  //          and regular internal contractors (companyId set, contractorType null/undefined/"").
  const requireEstimateAccess = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = req.user as User;
    if (user.role === "admin") return next();
    if (user.role === "client") {
      return res.status(403).json({ message: "Access denied" });
    }
    if (user.role === "company_owner" && user.companyId) return next();
    if (user.role === "contractor" && user.companyId) {
      if (user.isCompanyAdmin === true) return next();
      // Block external worker types explicitly
      if (user.contractorType === "subcontractor" || user.contractorType === "notary") {
        return res.status(403).json({ message: "Access denied" });
      }
      // Regular internal contractor: contractorType is null, undefined, or empty
      if (!user.contractorType) return next();
    }
    return res.status(403).json({ message: "Access denied" });
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
  // Admin: send a password reset email on behalf of any user
  app.post("/api/admin/users/:id/send-password-reset", requireAdmin, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.email) {
        return res.status(400).json({ message: "User has no email address on file." });
      }

      // Invalidate any existing unused tokens for this user
      await storage.invalidateUserPasswordResetTokens(user.id);

      // Generate a secure random token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken(user.id, tokenHash, expiresAt);

      await sendPasswordResetEmail(user.email, { userName: user.name ?? undefined, resetToken: rawToken });

      res.json({ message: `Password reset email sent to ${user.email}` });
      logAuditEvent(req, req.user as User, {
        action: "password_reset_sent",
        entityType: "user",
        entityId: user.id,
        entityName: user.name ?? user.username,
        companyId: user.companyId ?? null,
        metadata: { email: user.email },
      });
    } catch (err) {
      console.error("[admin send-password-reset] Error:", err);
      next(err);
    }
  });

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
      logAuditEvent(req, req.user as User, {
        action: "user_approved",
        entityType: "user",
        entityId: user.id,
        entityName: user.name ?? user.username,
        companyId: user.companyId ?? null,
        metadata: { role: user.role, email: user.email },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/contractors/:id/reject", requireAdmin, async (req, res, next) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      await storage.rejectContractor(req.params.id);
      res.json({ message: "Contractor rejected and removed" });
      if (targetUser) {
        logAuditEvent(req, req.user as User, {
          action: "user_rejected",
          entityType: "user",
          entityId: targetUser.id,
          entityName: targetUser.name ?? targetUser.username,
          companyId: targetUser.companyId ?? null,
          metadata: { email: targetUser.email, role: targetUser.role },
        });
      }
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
      // Full company record is restricted to company owners, company admins, and platform admins.
      // Regular internal contractors, clients, subcontractors, and notaries must use
      // GET /api/company/branding which returns only safe branding/contact fields.
      const canViewFullRecord =
        user.role === "company_owner" ||
        user.isCompanyAdmin === true ||
        user.role === "admin";
      if (!canViewFullRecord) {
        return res.status(403).json({
          message: "Access denied: company settings are restricted to company owners and admins",
        });
      }
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "No company found" });
      res.json(company);
    } catch (error) { next(error); }
  });

  // Normalizer: blank or invalid hex string → null (PDF layers apply per-field defaults)
  const normalizeHex = z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (!v || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) return null;
      return v;
    });

  // Branding-only allowlist — used to validate PATCH /api/company/mine from branding form
  // Blank or invalid color strings are silently normalized to null rather than returning 400.
  const companyBrandingSchema = z.object({
    name: z.string().min(1).optional(),
    logo: z.string().nullable().optional(),
    primaryColor: normalizeHex,
    accentColor: normalizeHex,
    quoteFooterText: z.string().nullable().optional(),
    companyPhone: z.string().nullable().optional(),
    companyEmail: z.string().nullable().optional(),
    companyAddress: z.string().nullable().optional(),
    companyWebsite: z.string().nullable().optional(),
  });

  // Update current user's company branding (owner or company admin only)
  // Uses strict Zod allowlist — billing/Stripe fields are stripped and cannot be written
  app.patch("/api/company/mine", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!user.companyId) return res.status(404).json({ message: "No company found" });
      if (user.role !== "company_owner" && user.role !== "admin" && user.isCompanyAdmin !== true) {
        return res.status(403).json({ message: "Only company owners and admins can update company settings" });
      }
      const parseResult = companyBrandingSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid branding data", errors: parseResult.error.issues });
      }
      const updated = await storage.updateCompany(user.companyId, parseResult.data);
      res.json(updated);
    } catch (error) { next(error); }
  });

  // Read-only branding endpoint for Estimator Calculator PDF export
  // Allowed: company_owner, internal contractor (no subcontractor/notary contractorType), company admins
  // Blocked: clients, subcontractors, notaries, anyone without companyId (including platform admins)
  app.get("/api/company/branding", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!user.companyId) return res.status(404).json({ message: "No company branding found" });
      if (user.role === "client") return res.status(403).json({ message: "Access denied" });
      if (user.contractorType === "subcontractor" || user.contractorType === "notary") {
        return res.status(403).json({ message: "Access denied" });
      }
      const company = await storage.getCompany(user.companyId);
      if (!company) return res.status(404).json({ message: "No company branding found" });
      // Colors always return with canonical defaults so PDF clients never receive null colors
      res.json({
        logo: company.logo ?? null,
        name: company.name,
        primaryColor: company.primaryColor ?? "#1f2937",
        accentColor: company.accentColor ?? "#d97706",
        quoteFooterText: company.quoteFooterText ?? null,
        companyPhone: company.companyPhone ?? null,
        companyEmail: company.companyEmail ?? null,
        companyAddress: company.companyAddress ?? null,
        companyWebsite: company.companyWebsite ?? null,
      });
    } catch (error) { next(error); }
  });

  // Proxy company logo image for PDF export — bypasses object storage ACL complexity
  // Allowed: same rules as /api/company/branding
  app.get("/api/company/branding/logo", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!user.companyId) return res.status(404).end();
      if (user.role === "client") return res.status(403).end();
      if (user.contractorType === "subcontractor" || user.contractorType === "notary") return res.status(403).end();
      const company = await storage.getCompany(user.companyId);
      if (!company?.logo) return res.status(404).end();
      const { ObjectStorageService } = await import("./replit_integrations/object_storage");
      const objectStorage = new ObjectStorageService();
      const file = await objectStorage.getObjectEntityFile(company.logo);
      const ext = company.logo.split(".").pop()?.toLowerCase();
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=300");
      await objectStorage.downloadObject(file, res);
    } catch (error: any) {
      if (error.name === "ObjectNotFoundError") return res.status(404).end();
      next(error);
    }
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

  // Helper: validate that userId is an internal company user of companyId.
  // Returns the user record if valid. Returns null if the user is not an internal member.
  // "Internal" means: role contractor or company_owner, contractorType null/empty (not subcontractor/notary),
  // and the user is linked to companyId either via users.companyId or via a company_members row.
  async function resolveInternalMember(companyId: string, userId: string): Promise<User | null> {
    const targetUser = await storage.getUser(userId);
    if (!targetUser) return null;
    // Must be contractor or company_owner — never clients, platform admins, subcontractors, or notaries
    if (targetUser.role !== "contractor" && targetUser.role !== "company_owner") return null;
    if (targetUser.contractorType === "subcontractor" || targetUser.contractorType === "notary") return null;
    // Accept if directly linked by companyId
    if (targetUser.companyId === companyId) return targetUser;
    // Also accept if they have an explicit company_members row (e.g. legacy join-table-only record)
    const membership = await storage.getCompanyMember(companyId, userId);
    if (membership) return targetUser;
    return null;
  }

  // Remove company member (owner or company admin of that company only)
  app.delete("/api/company/:companyId/members/:userId", requireAuth, async (req, res, next) => {
    try {
      const ok = await verifyCompanyAccess(req, res, req.params.companyId);
      if (!ok) return;
      const { companyId, userId } = req.params;
      const targetUser = await resolveInternalMember(companyId, userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User is not an internal member of this company" });
      }
      // Company owners cannot be removed via the Team management flow
      if (targetUser.role === "company_owner") {
        return res.status(403).json({ message: "Company owners cannot be removed from the team" });
      }
      // Remove the join-table row if it exists
      await storage.removeCompanyMember(companyId, userId);
      // Also clear the direct companyId link on the user record if still pointing at this company
      if (targetUser.companyId === companyId) {
        await storage.updateUser(userId, { companyId: null, isCompanyAdmin: false });
      }
      res.json({ message: "Member removed" });
    } catch (error) { next(error); }
  });

  // Assign/update role template for a company member
  app.patch("/api/company/:companyId/members/:userId/role", requireAuth, async (req, res, next) => {
    try {
      const ok = await verifyCompanyAccess(req, res, req.params.companyId);
      if (!ok) return;
      const { companyId, userId } = req.params;
      const { roleDefinitionId } = req.body;
      // Allow null to clear assignment; validate if a value is provided
      if (roleDefinitionId) {
        const roleDef = await storage.getContractorRoleDefinition(roleDefinitionId);
        if (!roleDef) return res.status(404).json({ message: "Role definition not found" });
      }
      // Ensure a company_members row exists so updateCompanyMember has a row to update.
      // For direct users.companyId members, upsert a row first.
      let existingRow = await storage.getCompanyMember(companyId, userId);
      if (!existingRow) {
        const targetUser = await resolveInternalMember(companyId, userId);
        if (!targetUser) return res.status(404).json({ message: "Member not found" });
        existingRow = await storage.addCompanyMember({ companyId, userId, status: "active", roleDefinitionId: null });
      }
      const updated = await storage.updateCompanyMember(companyId, userId, {
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
      const { companyId, userId } = req.params;
      if (caller.id === userId) {
        return res.status(400).json({ message: "Cannot change your own admin status" });
      }
      // Validate target user is actually an internal member of this company (prevent privilege escalation).
      // Accepts both company_members join-table members and direct users.companyId members.
      const targetUser = await resolveInternalMember(companyId, userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User is not a member of this company" });
      }
      const { isCompanyAdmin } = req.body;
      if (typeof isCompanyAdmin !== "boolean") {
        return res.status(400).json({ message: "isCompanyAdmin must be a boolean" });
      }
      await storage.updateUser(userId, { isCompanyAdmin });
      res.json({ message: "Admin status updated" });
    } catch (error) { next(error); }
  });

  // Admin: list all companies with owner and member count
  app.get("/api/admin/companies", requireAdmin, async (req, res, next) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.toLowerCase().trim() : "";
      const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const companies = await storage.getAllCompanies();
      const [allUsers, ...companyExtras] = await Promise.all([
        storage.getAllUsers(),
        ...companies.map(c => Promise.all([
          storage.getUserByCompanyOwner(c.id),
          storage.getProjectsByCompanyId(c.id),
        ])),
      ]);
      const usersByCompany = new Map<string, number>();
      for (const u of allUsers) {
        if (u.companyId) {
          usersByCompany.set(u.companyId, (usersByCompany.get(u.companyId) ?? 0) + 1);
        }
      }
      const enriched = companies.map((company, idx) => {
        const [owner, projects] = companyExtras[idx] as [typeof allUsers[0] | undefined, { id: string }[]];
        return {
          ...company,
          userCount: usersByCompany.get(company.id) ?? 0,
          projectCount: projects.length,
          ownerName: owner ? (owner.name || owner.username) : null,
          ownerUserId: owner?.id ?? null,
          ownerEmail: owner?.email ?? null,
        };
      });
      let filtered = enriched;
      if (search) {
        filtered = filtered.filter(c =>
          c.name.toLowerCase().includes(search) ||
          (c.ownerEmail?.toLowerCase() || "").includes(search) ||
          (c.ownerName?.toLowerCase() || "").includes(search)
        );
      }
      if (status && status !== "all") {
        filtered = filtered.filter(c => (c.subscriptionStatus ?? "free") === status);
      }
      res.json(filtered);
    } catch (error) { next(error); }
  });

  // ── Admin: List all users (with optional search/role filtering) ────────────
  app.get("/api/admin/users", requireAdmin, async (req, res, next) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search.toLowerCase().trim() : "";
      const role = typeof req.query.role === "string" ? req.query.role.trim() : "";
      const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const companyId = typeof req.query.companyId === "string" ? req.query.companyId.trim() : "";
      let users = await storage.getAllUsers();
      users = users.filter(u => !u.isSandbox);
      if (search) {
        users = users.filter(u =>
          (u.name?.toLowerCase() || "").includes(search) ||
          (u.username?.toLowerCase() || "").includes(search) ||
          (u.email?.toLowerCase() || "").includes(search) ||
          (u.role?.toLowerCase() || "").includes(search)
        );
      }
      if (role && role !== "all") {
        users = users.filter(u => u.role === role);
      }
      if (status && status !== "all") {
        if (status === "pending") users = users.filter(u => u.isApproved === false && !u.isDisabled);
        else if (status === "disabled") users = users.filter(u => u.isDisabled === true);
        else if (status === "active") users = users.filter(u => u.isApproved !== false && !u.isDisabled);
      }
      if (companyId) {
        users = users.filter(u => u.companyId === companyId);
      }
      res.json(users.map(({ password: _, ...u }) => u));
    } catch (error) { next(error); }
  });

  // ── Admin: User detail ─────────────────────────────────────────────────────
  app.get("/api/admin/users/:id", requireAdmin, async (req, res, next) => {
    try {
      const u = await storage.getUser(req.params.id);
      if (!u) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = u;
      // Attach company if applicable
      let company = null;
      if (u.companyId) {
        company = await storage.getCompany(u.companyId) ?? null;
      }
      // Related projects
      let projects: { id: string; name: string; status: string; companyName?: string }[] = [];
      if (u.role === "client") {
        const clientProjects = await storage.getProjectsByClientId(u.id);
        const allCompanies = await storage.getAllCompanies();
        const companyMap = new Map(allCompanies.map(c => [c.id, c.name]));
        const allUsers = await storage.getAllUsers();
        const userMap = new Map(allUsers.map(user => [user.id, user]));
        projects = clientProjects.map(p => {
          let companyName: string | undefined;
          if (p.contractorId) {
            const contractor = userMap.get(p.contractorId);
            if (contractor?.companyId) companyName = companyMap.get(contractor.companyId);
          }
          return { id: p.id, name: p.name, status: p.status, companyName };
        });
      } else if (u.role === "contractor" || u.role === "company_owner") {
        const contProjects = await storage.getContractorProjectsWithDetails(u.id);
        projects = contProjects.map(p => ({ id: p.id, name: p.name, status: p.status, companyName: p.companyName }));
      } else if (u.companyId) {
        const companyProjects = await storage.getProjectsByCompanyId(u.companyId);
        projects = companyProjects.map(p => ({ id: p.id, name: p.name, status: p.status }));
      }
      // Pending invite count (contractor invites for company-based users)
      let pendingInviteCount = 0;
      if (u.companyId) {
        const companyInvites = await storage.getContractorInvitesByCompanyId(u.companyId);
        pendingInviteCount = companyInvites.filter(i => i.status === "pending").length;
      }
      res.json({ ...safeUser, company, projects, pendingInviteCount });
    } catch (error) { next(error); }
  });

  // ── Admin: Approve / reject user (aliases that work by userId) ────────────
  app.post("/api/admin/users/:id/approve", requireAdmin, async (req, res, next) => {
    try {
      const user = await storage.approveContractor(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ message: "User approved successfully" });
      logAuditEvent(req, req.user as User, {
        action: "user_approved",
        entityType: "user",
        entityId: user.id,
        entityName: user.name ?? user.username,
        companyId: user.companyId ?? null,
        metadata: { role: user.role, email: user.email },
      });
    } catch (error) { next(error); }
  });

  app.post("/api/admin/users/:id/reject", requireAdmin, async (req, res, next) => {
    try {
      const targetUser = await storage.getUser(req.params.id);
      await storage.rejectContractor(req.params.id);
      res.json({ message: "User rejected and removed" });
      if (targetUser) {
        logAuditEvent(req, req.user as User, {
          action: "user_rejected",
          entityType: "user",
          entityId: targetUser.id,
          entityName: targetUser.name ?? targetUser.username,
          companyId: targetUser.companyId ?? null,
          metadata: { email: targetUser.email, role: targetUser.role },
        });
      }
    } catch (error) { next(error); }
  });

  // ── Admin: Disable / reactivate user ──────────────────────────────────────
  app.patch("/api/admin/users/:id/disable", requireAdmin, async (req, res, next) => {
    try {
      const adminUser = req.user as User;
      if (adminUser.id === req.params.id) {
        return res.status(400).json({ message: "You cannot disable your own account." });
      }
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "User not found" });
      await storage.updateUser(req.params.id, { isDisabled: true });
      res.json({ message: "User disabled successfully" });
      logAuditEvent(req, adminUser, {
        action: "user_disabled",
        entityType: "user",
        entityId: target.id,
        entityName: target.name ?? target.username,
        companyId: target.companyId ?? null,
        metadata: { email: target.email, role: target.role, previousState: target.isDisabled ? "disabled" : "active", newState: "disabled" },
      });
    } catch (error) { next(error); }
  });

  app.patch("/api/admin/users/:id/reactivate", requireAdmin, async (req, res, next) => {
    try {
      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ message: "User not found" });
      await storage.updateUser(req.params.id, { isDisabled: false });
      res.json({ message: "User reactivated successfully" });
      logAuditEvent(req, req.user as User, {
        action: "user_reactivated",
        entityType: "user",
        entityId: target.id,
        entityName: target.name ?? target.username,
        companyId: target.companyId ?? null,
        metadata: { email: target.email, role: target.role, previousState: target.isDisabled ? "disabled" : "active", newState: "active" },
      });
    } catch (error) { next(error); }
  });

  // ── Admin: Create company + owner account ─────────────────────────────────────
  const adminCreateCompanySchema = z.object({
    companyName: z.string().min(1).max(200),
    ownerName: z.string().min(1).max(200),
    ownerEmail: z.string().email(),
    ownerUsername: z.string().min(3).max(100),
    password: z.string().min(6),
    companyType: z.string().optional(),
    subscriptionStatus: z.enum(["active", "free", "prepaid", "expired", "cancelled", "suspended"]).default("free"),
    billingType: z.enum(["manual", "in_app", "prepaid", "included_with_service", "free_demo"]).default("manual"),
    monthlyPrice: z.string().nullable().optional(),
    trialStartedAt: z.string().datetime({ offset: true }).nullable().optional(),
    trialEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
    prepaidThroughDate: z.string().datetime({ offset: true }).nullable().optional(),
    accessNotes: z.string().max(2000).nullable().optional(),
  });

  app.post("/api/admin/companies", requireAdmin, async (req, res, next) => {
    try {
      const parsed = adminCreateCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
      }
      const { companyName, ownerName, ownerEmail, ownerUsername, password, companyType, subscriptionStatus, billingType, monthlyPrice, trialStartedAt, trialEndsAt, prepaidThroughDate, accessNotes } = parsed.data;

      const existingByUsername = await storage.getUserByUsername(ownerUsername);
      if (existingByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const existingByEmail = await storage.getUserByEmail(ownerEmail);
      if (existingByEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      // Create company + owner atomically in a single transaction
      const { company, user } = await storage.createCompanyWithOwner(
        {
          name: companyName.trim(),
          subscriptionStatus,
          billingType,
          monthlyPrice: monthlyPrice || null,
          trialStartedAt: trialStartedAt ? new Date(trialStartedAt) : null,
          trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
          prepaidThroughDate: prepaidThroughDate ? new Date(prepaidThroughDate) : null,
          accessNotes: accessNotes || null,
        },
        {
          username: ownerUsername.trim(),
          email: ownerEmail.trim().toLowerCase(),
          password: hashedPassword,
          role: "company_owner",
          name: ownerName.trim(),
          companyName: companyName.trim(),
          companyType: companyType?.trim() || null,
          isApproved: true,
        }
      );

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json({ company, user: userWithoutPassword });
      logAuditEvent(req, req.user as User, {
        action: "company_created",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        companyId: company.id,
        metadata: { ownerEmail: ownerEmail.trim().toLowerCase(), subscriptionStatus, billingType },
      });
    } catch (error) { next(error); }
  });

  // ── Admin: Update company subscription ───────────────────────────────────────
  const VALID_SUBSCRIPTION_STATUSES = ["active", "free", "prepaid", "expired", "cancelled", "suspended"] as const;

  const adminCompanySubscriptionSchema = z.object({
    subscriptionStatus: z.enum(["active", "free", "prepaid", "expired", "cancelled", "suspended"]).optional(),
    trialStartedAt: z.string().datetime({ offset: true }).nullable().optional(),
    trialEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
    prepaidThroughDate: z.string().datetime({ offset: true }).nullable().optional(),
    billingType: z.enum(["manual", "in_app", "prepaid", "included_with_service", "free_demo"]).optional(),
    monthlyPrice: z.string().nullable().optional(),
    billingNotes: z.string().max(2000).nullable().optional(),
    accessNotes: z.string().max(2000).nullable().optional(),
  });

  app.patch("/api/admin/companies/:id/subscription", requireAdmin, async (req, res, next) => {
    try {
      const parsed = adminCompanySubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid subscription data", errors: parsed.error.flatten().fieldErrors });
      }
      const { subscriptionStatus, trialStartedAt, trialEndsAt, prepaidThroughDate, billingType, monthlyPrice, billingNotes, accessNotes } = parsed.data;
      const beforeSub = await storage.getCompany(req.params.id);
      const updateData: Partial<InsertCompany> = {};
      if (subscriptionStatus !== undefined) {
        updateData.subscriptionStatus = subscriptionStatus;
      }
      if (trialStartedAt !== undefined) updateData.trialStartedAt = trialStartedAt ? new Date(trialStartedAt) : null;
      if (trialEndsAt !== undefined) updateData.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
      if (prepaidThroughDate !== undefined) updateData.prepaidThroughDate = prepaidThroughDate ? new Date(prepaidThroughDate) : null;
      if (billingType !== undefined) updateData.billingType = billingType;
      if (monthlyPrice !== undefined) updateData.monthlyPrice = monthlyPrice;
      if (billingNotes !== undefined) updateData.billingNotes = billingNotes;
      if (accessNotes !== undefined) updateData.accessNotes = accessNotes;
      const company = await storage.updateCompany(req.params.id, updateData);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
      const subMeta: Record<string, unknown> = {};
      if (subscriptionStatus !== undefined) {
        subMeta.oldSubscriptionStatus = beforeSub?.subscriptionStatus ?? null;
        subMeta.newSubscriptionStatus = subscriptionStatus;
      }
      if (billingType !== undefined) {
        subMeta.oldBillingType = beforeSub?.billingType ?? null;
        subMeta.newBillingType = billingType;
      }
      if (monthlyPrice !== undefined) {
        subMeta.oldMonthlyPrice = beforeSub?.monthlyPrice ?? null;
        subMeta.newMonthlyPrice = monthlyPrice;
      }
      if (billingNotes !== undefined) subMeta.billingNotes = billingNotes;
      if (accessNotes !== undefined) subMeta.accessNotes = accessNotes;
      logAuditEvent(req, req.user as User, {
        action: "company_access_updated",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        companyId: company.id,
        metadata: subMeta,
      });
    } catch (error) { next(error); }
  });

  // ── Admin: Suspend / Reactivate company ──────────────────────────────────────
  app.patch("/api/admin/companies/:id/suspend", requireAdmin, async (req, res, next) => {
    try {
      const beforeSuspend = await storage.getCompany(req.params.id);
      const company = await storage.updateCompany(req.params.id, { subscriptionStatus: "suspended" });
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
      logAuditEvent(req, req.user as User, {
        action: "company_suspended",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        companyId: company.id,
        metadata: { previousState: beforeSuspend?.subscriptionStatus ?? null, newState: "suspended" },
      });
    } catch (error) { next(error); }
  });

  app.patch("/api/admin/companies/:id/reactivate", requireAdmin, async (req, res, next) => {
    try {
      const beforeReactivate = await storage.getCompany(req.params.id);
      const company = await storage.updateCompany(req.params.id, { subscriptionStatus: "active" });
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
      logAuditEvent(req, req.user as User, {
        action: "company_reactivated",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        companyId: company.id,
        metadata: { previousState: beforeReactivate?.subscriptionStatus ?? null, newState: "active" },
      });
    } catch (error) { next(error); }
  });

  // ── Admin: Get company detail ─────────────────────────────────────────────
  app.get("/api/admin/companies/:id", requireAdmin, async (req, res, next) => {
    try {
      const company = await storage.getCompany(req.params.id);
      if (!company) return res.status(404).json({ message: "Company not found" });
      const [owner, users, projects, contractorInvites, allUsers] = await Promise.all([
        storage.getUserByCompanyOwner(company.id),
        storage.getUsersByCompanyId(company.id),
        storage.getProjectsByCompanyId(company.id),
        storage.getContractorInvitesByCompanyId(company.id),
        storage.getAllUsers(),
      ]);
      const usersById = new Map(allUsers.map(u => [u.id, u]));

      // Fetch client/project invites for all company projects
      const projectInviteArrays = await Promise.all(
        projects.map(p => storage.getProjectInvitesByProjectId(p.id))
      );
      const projectInvites = projectInviteArrays.flat();

      const allInvitesRaw = [...contractorInvites, ...projectInvites];
      const pendingInviteCount = allInvitesRaw.filter(i => effectiveStatus(i.status, i.expiresAt) === "pending").length;

      const enrichedProjects = projects.map(p => {
        const client = p.clientId ? usersById.get(p.clientId) : undefined;
        const contractor = p.contractorId ? usersById.get(p.contractorId) : undefined;
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          progress: p.progress,
          budget: p.budget,
          createdAt: p.createdAt,
          dueDate: p.dueDate,
          clientId: client?.id ?? null,
          clientName: client ? (client.name || client.username) : null,
          clientEmail: client?.email ?? null,
          contractorName: contractor ? (contractor.name || contractor.username) : null,
        };
      });

      const enrichedContractorInvites = contractorInvites.map(inv => {
        const project = inv.projectId ? projects.find(p => p.id === inv.projectId) : null;
        return {
          id: inv.id,
          email: inv.email,
          inviteKind: "contractor" as const,
          contractorType: inv.contractorType,
          projectId: inv.projectId,
          projectName: project?.name ?? null,
          status: effectiveStatus(inv.status, inv.expiresAt),
          createdAt: inv.createdAt?.toISOString() ?? null,
          acceptedAt: inv.acceptedAt?.toISOString() ?? null,
          expiresAt: inv.expiresAt?.toISOString() ?? null,
          revokedAt: inv.revokedAt?.toISOString() ?? null,
          resendCount: inv.resendCount ?? 0,
          lastResentAt: inv.lastResentAt?.toISOString() ?? null,
        };
      });

      const enrichedProjectInvites = projectInvites.map(inv => {
        const project = inv.projectId ? projects.find(p => p.id === inv.projectId) : null;
        return {
          id: inv.id,
          email: inv.email,
          inviteKind: "project" as const,
          contractorType: null,
          projectId: inv.projectId,
          projectName: project?.name ?? null,
          status: effectiveStatus(inv.status, inv.expiresAt),
          createdAt: inv.createdAt?.toISOString() ?? null,
          acceptedAt: inv.acceptedAt?.toISOString() ?? null,
          expiresAt: inv.expiresAt?.toISOString() ?? null,
          revokedAt: inv.revokedAt?.toISOString() ?? null,
          resendCount: inv.resendCount ?? 0,
          lastResentAt: inv.lastResentAt?.toISOString() ?? null,
        };
      });

      const allInvites = [...enrichedContractorInvites, ...enrichedProjectInvites].sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );

      res.json({
        ...company,
        pendingInviteCount,
        owner: owner ? { id: owner.id, name: owner.name, username: owner.username, email: owner.email, role: owner.role, companyType: owner.companyType, isApproved: owner.isApproved } : null,
        users: users.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, contractorType: u.contractorType, isApproved: u.isApproved })),
        projects: enrichedProjects,
        invites: allInvites,
      });
    } catch (error) { next(error); }
  });

  // ── Admin: Update company general fields (billing, notes, etc.) ───────────
  const adminCompanyUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    subscriptionStatus: z.enum(["active", "free", "prepaid", "expired", "cancelled", "suspended"]).optional(),
    billingType: z.enum(["manual", "in_app", "prepaid", "included_with_service", "free_demo"]).optional(),
    monthlyPrice: z.string().nullable().optional(),
    trialStartedAt: z.string().datetime({ offset: true }).nullable().optional(),
    trialEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
    prepaidThroughDate: z.string().datetime({ offset: true }).nullable().optional(),
    billingNotes: z.string().max(2000).nullable().optional(),
    adminNotes: z.string().max(5000).nullable().optional(),
    accessNotes: z.string().max(2000).nullable().optional(),
  });

  app.patch("/api/admin/companies/:id", requireAdmin, async (req, res, next) => {
    try {
      const parsed = adminCompanyUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
      }
      const { name, subscriptionStatus, billingType, monthlyPrice, trialStartedAt, trialEndsAt, prepaidThroughDate, billingNotes, adminNotes, accessNotes } = parsed.data;
      const beforeCompany = await storage.getCompany(req.params.id);
      const updateData: Partial<InsertCompany> = {};
      if (name !== undefined) updateData.name = name;
      if (subscriptionStatus !== undefined) updateData.subscriptionStatus = subscriptionStatus;
      if (billingType !== undefined) updateData.billingType = billingType;
      if (monthlyPrice !== undefined) updateData.monthlyPrice = monthlyPrice;
      if (trialStartedAt !== undefined) updateData.trialStartedAt = trialStartedAt ? new Date(trialStartedAt) : null;
      if (trialEndsAt !== undefined) updateData.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
      if (prepaidThroughDate !== undefined) updateData.prepaidThroughDate = prepaidThroughDate ? new Date(prepaidThroughDate) : null;
      if (billingNotes !== undefined) updateData.billingNotes = billingNotes;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (accessNotes !== undefined) updateData.accessNotes = accessNotes;
      const company = await storage.updateCompany(req.params.id, updateData);
      if (!company) return res.status(404).json({ message: "Company not found" });
      res.json(company);
      const genMeta: Record<string, unknown> = {};
      if (name !== undefined) genMeta.name = name;
      if (subscriptionStatus !== undefined) {
        genMeta.oldSubscriptionStatus = beforeCompany?.subscriptionStatus ?? null;
        genMeta.newSubscriptionStatus = subscriptionStatus;
      }
      if (billingType !== undefined) {
        genMeta.oldBillingType = beforeCompany?.billingType ?? null;
        genMeta.newBillingType = billingType;
      }
      if (monthlyPrice !== undefined) {
        genMeta.oldMonthlyPrice = beforeCompany?.monthlyPrice ?? null;
        genMeta.newMonthlyPrice = monthlyPrice;
      }
      if (billingNotes !== undefined) genMeta.billingNotes = billingNotes;
      if (accessNotes !== undefined) genMeta.accessNotes = accessNotes;
      logAuditEvent(req, req.user as User, {
        action: "company_access_updated",
        entityType: "company",
        entityId: company.id,
        entityName: company.name,
        companyId: company.id,
        metadata: genMeta,
      });
    } catch (error) { next(error); }
  });

  // ── Admin: Demo requests ──────────────────────────────────────────────────────
  app.get("/api/admin/demo-requests", requireAdmin, async (req, res, next) => {
    try {
      const requests = await storage.getDemoRequests();
      res.json(requests);
    } catch (error) { next(error); }
  });

  app.patch("/api/admin/demo-requests/:id", requireAdmin, async (req, res, next) => {
    try {
      const updateSchema = z.object({
        status: z.enum(["new", "contacted", "demo_scheduled", "converted", "closed"]).optional(),
        internalNotes: z.string().nullable().optional(),
        followUpDate: z.string().nullable().optional(),
        convertedCompanyId: z.string().nullable().optional(),
      });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
      const payload: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.followUpDate !== undefined) {
        payload.followUpDate = parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null;
      }
      const beforeLead = await storage.getDemoRequest(req.params.id);
      const updated = await storage.updateDemoRequest(req.params.id, payload as Parameters<typeof storage.updateDemoRequest>[1]);
      if (!updated) return res.status(404).json({ message: "Demo request not found" });
      res.json(updated);
      const isConversion = parsed.data.convertedCompanyId != null;
      logAuditEvent(req, req.user as User, {
        action: isConversion ? "demo_request_converted" : "demo_request_status_updated",
        entityType: "demo_request",
        entityId: updated.id,
        entityName: updated.name,
        companyId: isConversion ? (updated.convertedCompanyId ?? null) : null,
        metadata: {
          oldStatus: beforeLead?.status ?? null,
          newStatus: updated.status,
          convertedCompanyId: updated.convertedCompanyId ?? null,
        },
      });
    } catch (error) { next(error); }
  });

  app.post("/api/admin/demo-requests/:id/retry-hubspot", requireAdmin, async (req, res, next) => {
    try {
      const lead = await storage.getDemoRequest(req.params.id);
      if (!lead) return res.status(404).json({ message: "Demo request not found" });
      const { syncDemoRequestToHubSpot, trimError } = await import("./hubspot");
      const syncResult = await syncDemoRequestToHubSpot(lead);
      // Explicitly trim here as well — defence-in-depth against oversized error strings
      const syncError = syncResult.status === "failed" && syncResult.error
        ? trimError(syncResult.error)
        : null;
      const updated = await storage.updateDemoRequest(lead.id, {
        hubspotSyncStatus: syncResult.status,
        hubspotContactId: syncResult.contactId ?? lead.hubspotContactId,
        hubspotCompanyId: syncResult.companyId ?? lead.hubspotCompanyId,
        hubspotDealId: syncResult.dealId ?? lead.hubspotDealId,
        hubspotLastSyncedAt: syncResult.status === "synced" ? new Date() : lead.hubspotLastSyncedAt,
        hubspotSyncError: syncError,
      });
      res.json(updated);
      logAuditEvent(req, req.user as User, {
        action: "hubspot_sync_retried",
        entityType: "demo_request",
        entityId: lead.id,
        entityName: lead.name,
        metadata: { syncStatus: syncResult.status, error: syncError ?? null },
      });
    } catch (error) { next(error); }
  });

  // ── Admin: Global invite listing ──────────────────────────────────────────────
  // ── Helper: compute effective invite status (pending past expiresAt → "expired") ─
  function effectiveStatus(status: string, expiresAt: Date | string): string {
    if (status === "pending" && new Date() > new Date(expiresAt)) return "expired";
    return status;
  }

  // ── Helper: build the full enriched invite shape for admin UI ─────────────────
  function enrichProjectInvite(
    inv: ProjectInvite,
    projectMap: Map<string, Project>,
    companyMap: Map<string, Company>,
    userMap: Map<string, User>
  ) {
    const project = inv.projectId ? projectMap.get(inv.projectId) : null;
    const invitedByUser = inv.invitedBy ? userMap.get(inv.invitedBy) : null;
    // Derive company from the project's contractor chain — reliable even when a Super Admin sent the invite
    const projectContractor = project?.contractorId ? userMap.get(project.contractorId) : null;
    const companyFromProject = projectContractor?.companyId ? companyMap.get(projectContractor.companyId) : null;
    // Fall back to the inviting user's company if the project chain yields nothing
    const companyFromUser = !companyFromProject && invitedByUser?.companyId ? companyMap.get(invitedByUser.companyId) : null;
    const resolvedCompany = companyFromProject ?? companyFromUser ?? null;
    const acceptedUser = inv.invitedUserId ? userMap.get(inv.invitedUserId) : null;
    return {
      id: inv.id,
      inviteType: "client",
      email: inv.email,
      clientName: inv.clientName ?? null,
      status: effectiveStatus(inv.status, inv.expiresAt),
      projectId: inv.projectId ?? null,
      projectName: project?.name ?? null,
      companyId: resolvedCompany?.id ?? null,
      companyName: resolvedCompany?.name ?? null,
      invitedByName: invitedByUser ? (invitedByUser.name || invitedByUser.username) : null,
      acceptedUserId: inv.invitedUserId ?? null,
      acceptedUserName: acceptedUser ? (acceptedUser.name || acceptedUser.username) : null,
      sentAt: inv.createdAt,
      acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
      revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
      expiresAt: inv.expiresAt,
      resendCount: inv.resendCount,
      lastResentAt: inv.lastResentAt ? inv.lastResentAt.toISOString() : null,
    };
  }

  function enrichContractorInvite(
    inv: ContractorInvite,
    projectMap: Map<string, Project>,
    companyMap: Map<string, Company>,
    userMap: Map<string, User>
  ) {
    const project = inv.projectId ? projectMap.get(inv.projectId) : null;
    const company = inv.companyId ? companyMap.get(inv.companyId) : null;
    const invitedByUser = inv.invitedBy ? userMap.get(inv.invitedBy) : null;
    const acceptedUser = inv.acceptedUserId ? userMap.get(inv.acceptedUserId) : null;
    const typeLabel = inv.contractorType || "contractor";
    return {
      id: inv.id,
      inviteType: typeLabel,
      email: inv.email,
      clientName: null,
      status: effectiveStatus(inv.status, inv.expiresAt),
      projectId: inv.projectId ?? null,
      projectName: project?.name ?? null,
      companyId: company?.id ?? inv.companyId ?? null,
      companyName: company?.name ?? (inv.companyName ?? null),
      invitedByName: invitedByUser ? (invitedByUser.name || invitedByUser.username) : null,
      acceptedUserId: inv.acceptedUserId ?? null,
      acceptedUserName: acceptedUser ? (acceptedUser.name || acceptedUser.username) : null,
      sentAt: inv.createdAt,
      acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
      revokedAt: inv.revokedAt ? inv.revokedAt.toISOString() : null,
      expiresAt: inv.expiresAt,
      resendCount: inv.resendCount,
      lastResentAt: inv.lastResentAt ? inv.lastResentAt.toISOString() : null,
    };
  }

  app.get("/api/admin/invites", requireAdmin, async (req, res, next) => {
    try {
      const [allProjectInvites, allContractorInvites, allProjects, allCompanies, allUsers] = await Promise.all([
        storage.getAllProjectInvites() as Promise<ProjectInvite[]>,
        storage.getAllContractorInvites() as Promise<ContractorInvite[]>,
        storage.getProjects() as Promise<Project[]>,
        storage.getAllCompanies() as Promise<Company[]>,
        storage.getAllUsers() as Promise<User[]>,
      ]);

      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const companyMap = new Map(allCompanies.map(c => [c.id, c]));
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const allInvites = [
        ...allProjectInvites.map(inv => enrichProjectInvite(inv, projectMap, companyMap, userMap)),
        ...allContractorInvites.map(inv => enrichContractorInvite(inv, projectMap, companyMap, userMap)),
      ].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

      res.json(allInvites);
    } catch (error) { next(error); }
  });

  app.get("/api/admin/invites/:id", requireAdmin, async (req, res, next) => {
    try {
      const [allProjects, allCompanies, allUsers] = await Promise.all([
        storage.getProjects() as Promise<Project[]>,
        storage.getAllCompanies() as Promise<Company[]>,
        storage.getAllUsers() as Promise<User[]>,
      ]);
      const projectMap = new Map(allProjects.map(p => [p.id, p]));
      const companyMap = new Map(allCompanies.map(c => [c.id, c]));
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const projectInvite = await storage.getProjectInviteById(req.params.id);
      if (projectInvite) {
        return res.json(enrichProjectInvite(projectInvite, projectMap, companyMap, userMap));
      }
      const contractorInvite = await storage.getContractorInviteById(req.params.id);
      if (contractorInvite) {
        return res.json(enrichContractorInvite(contractorInvite, projectMap, companyMap, userMap));
      }
      return res.status(404).json({ message: "Invite not found" });
    } catch (error) { next(error); }
  });

  app.post("/api/admin/invites/:id/revoke", requireAdmin, async (req, res, next) => {
    try {
      const { type } = req.body as { type?: string };
      const isContractorType = type === "contractor" || type === "subcontractor" || type === "notary";
      const now = new Date();

      let existing: ContractorInvite | ProjectInvite | undefined;
      let kind: "project" | "contractor" = "project";

      if (isContractorType) {
        existing = await storage.getContractorInviteById(req.params.id);
        kind = "contractor";
      } else {
        existing = await storage.getProjectInviteById(req.params.id);
        if (!existing) {
          existing = await storage.getContractorInviteById(req.params.id);
          kind = "contractor";
        }
      }

      if (!existing) return res.status(404).json({ message: "Invite not found" });
      if (existing.status !== "pending") {
        const reason =
          existing.status === "accepted" ? "Cannot revoke an accepted invite — the user already has access." :
          existing.status === "revoked" ? "This invite has already been revoked." :
          `Cannot revoke a ${existing.status} invite.`;
        return res.status(400).json({ message: reason });
      }

      let updated: ContractorInvite | ProjectInvite | undefined;
      if (kind === "contractor") {
        updated = await storage.updateContractorInvite(req.params.id, { status: "revoked", revokedAt: now });
      } else {
        updated = await storage.updateProjectInvite(req.params.id, { status: "revoked", revokedAt: now });
      }
      if (!updated) return res.status(404).json({ message: "Invite not found" });
      res.json(updated);
      let revokeCompanyId: string | null = (existing as ContractorInvite).companyId ?? null;
      if (kind === "project" && (existing as ProjectInvite).projectId) {
        const revokeProject = await storage.getProject((existing as ProjectInvite).projectId!);
        if (revokeProject?.contractorId) {
          const revokeContractor = await storage.getUser(revokeProject.contractorId);
          revokeCompanyId = revokeContractor?.companyId ?? null;
        }
      }
      logAuditEvent(req, req.user as User, {
        action: "invite_revoked",
        entityType: "invite",
        entityId: updated.id,
        entityName: existing.email,
        companyId: revokeCompanyId,
        projectId: kind === "project" ? ((existing as ProjectInvite).projectId ?? null) : null,
        metadata: { inviteType: kind, email: existing.email },
      });
    } catch (error) { next(error); }
  });

  app.post("/api/admin/invites/:id/resend", requireAdmin, async (req, res, next) => {
    try {
      const { type } = req.body as { type?: string };
      const isContractorType = type === "contractor" || type === "subcontractor" || type === "notary";

      let invite: ContractorInvite | ProjectInvite | undefined;
      let inviteKind: "project" | "contractor" = "project";

      if (isContractorType) {
        invite = await storage.getContractorInviteById(req.params.id);
        inviteKind = "contractor";
      } else {
        invite = await storage.getProjectInviteById(req.params.id);
        if (!invite) {
          invite = await storage.getContractorInviteById(req.params.id);
          inviteKind = "contractor";
        }
      }

      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.status === "accepted") {
        return res.status(400).json({ message: "Cannot resend an accepted invite — the user already has access." });
      }
      if (invite.status === "revoked") {
        return res.status(400).json({ message: "Cannot resend a revoked invite." });
      }

      // Generate a fresh token and extend expiry by 7 days
      const newToken = require("crypto").randomBytes(32).toString("hex");
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();
      const currentResendCount = invite.resendCount ?? 0;

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPLIT_DOMAINS?.split(",")[0]
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : "http://localhost:5000";

      if (inviteKind === "project") {
        const projectInvite = invite as ProjectInvite;
        await storage.updateProjectInvite(req.params.id, {
          token: newToken,
          status: "pending",
          expiresAt: newExpiresAt,
          resendCount: currentResendCount + 1,
          lastResentAt: now,
        });
        const project = projectInvite.projectId ? await storage.getProject(projectInvite.projectId) : null;
        const existingUser = await storage.getUserByEmail(projectInvite.email);
        const { sendProjectInviteEmail } = await import("./email");
        await sendProjectInviteEmail(projectInvite.email, {
          projectName: project?.name ?? "Your Project",
          contractorName: "Near Me Construct",
          inviteToken: newToken,
          clientName: projectInvite.clientName ?? undefined,
          isExistingUser: !!existingUser,
        });
      } else {
        const contractorInvite = invite as ContractorInvite;
        await storage.updateContractorInvite(req.params.id, {
          token: newToken,
          status: "pending",
          expiresAt: newExpiresAt,
          resendCount: currentResendCount + 1,
          lastResentAt: now,
        });
        const project = contractorInvite.projectId ? await storage.getProject(contractorInvite.projectId) : null;
        const role: "subcontractor" | "notary" = contractorInvite.contractorType === "notary" ? "notary" : "subcontractor";
        const isNewUser = !contractorInvite.acceptedUserId;
        const { sendExternalInviteEmail } = await import("./email");
        await sendExternalInviteEmail(contractorInvite.email, {
          inviterName: "Near Me Construct",
          projectName: project?.name ?? "Your Project",
          role,
          loginUrl: `${baseUrl}/auth`,
          isNewUser,
          registerUrl: isNewUser ? `${baseUrl}/subcontractor-invite/${newToken}` : undefined,
        });
      }

      res.json({ success: true, email: invite.email });
      let resendCompanyId: string | null = (invite as ContractorInvite).companyId ?? null;
      if (inviteKind === "project" && (invite as ProjectInvite).projectId) {
        const resendProject = await storage.getProject((invite as ProjectInvite).projectId!);
        if (resendProject?.contractorId) {
          const resendContractor = await storage.getUser(resendProject.contractorId);
          resendCompanyId = resendContractor?.companyId ?? null;
        }
      }
      logAuditEvent(req, req.user as User, {
        action: "invite_resent",
        entityType: "invite",
        entityId: invite.id,
        entityName: invite.email,
        companyId: resendCompanyId,
        projectId: inviteKind === "project" ? ((invite as ProjectInvite).projectId ?? null) : null,
        metadata: { inviteKind, email: invite.email },
      });
    } catch (error) { next(error); }
  });

  // Platform settings
  app.get("/api/admin/platform-settings", requireAdmin, async (req, res, next) => {
    try {
      const settings = await storage.getPlatformSettings();
      res.json(settings);
    } catch (error) { next(error); }
  });

  app.patch("/api/admin/platform-settings", requireAdmin, async (req, res, next) => {
    try {
      const settingsSchema = z.object({
        manualBillingEnabled: z.boolean().optional(),
        freeAccessEnabled: z.boolean().optional(),
        prepaidAccessEnabled: z.boolean().optional(),
        defaultMonthlyPrice: z.string().optional(),
      });
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
      const beforeSettings = await storage.getPlatformSettings();
      const updated = await storage.updatePlatformSettings(parsed.data);
      res.json(updated);
      const pricingMeta: Record<string, unknown> = {};
      if (parsed.data.defaultMonthlyPrice !== undefined) {
        pricingMeta.oldDefaultMonthlyPrice = beforeSettings?.defaultMonthlyPrice ?? null;
        pricingMeta.newDefaultMonthlyPrice = parsed.data.defaultMonthlyPrice;
      }
      if (parsed.data.manualBillingEnabled !== undefined) {
        pricingMeta.oldManualBillingEnabled = beforeSettings?.manualBillingEnabled ?? null;
        pricingMeta.newManualBillingEnabled = parsed.data.manualBillingEnabled;
      }
      if (parsed.data.freeAccessEnabled !== undefined) {
        pricingMeta.oldFreeAccessEnabled = beforeSettings?.freeAccessEnabled ?? null;
        pricingMeta.newFreeAccessEnabled = parsed.data.freeAccessEnabled;
      }
      if (parsed.data.prepaidAccessEnabled !== undefined) {
        pricingMeta.oldPrepaidAccessEnabled = beforeSettings?.prepaidAccessEnabled ?? null;
        pricingMeta.newPrepaidAccessEnabled = parsed.data.prepaidAccessEnabled;
      }
      logAuditEvent(req, req.user as User, {
        action: "pricing_access_updated",
        entityType: "platform",
        entityId: "platform",
        entityName: "Platform Settings",
        metadata: pricingMeta,
      });
    } catch (error) { next(error); }
  });

  // ── Admin: View As User ───────────────────────────────────────────────────────

  // Custom middleware: exit requires the view-as session to be active (req.user is viewed user).
  // The global middleware already clears adminData on expiry, so the userId check is usually
  // sufficient; the inactivity/hard-cap checks here are defense-in-depth.
  const requireViewAsSession = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    const session = req.session as any;
    if (!session.adminData?.userId) return res.status(403).json({ message: "No active view-as session" });
    const { startedAt = 0, lastActivityAt } = session.adminData;
    const now = Date.now();
    const lastActivity = lastActivityAt ?? startedAt;
    if ((now - lastActivity) > INACTIVITY_TIMEOUT_MS || (now - startedAt) > HARD_CAP_MS) {
      return res.status(403).json({ message: "View-as session expired" });
    }
    next();
  };

  // GET /api/admin/view-as/users — enriched list of company_owner + client users
  app.get("/api/admin/view-as/users", requireAdmin, async (req, res, next) => {
    try {
      const { search, role, companyId } = req.query as Record<string, string>;
      const [allUsers, allCompanies, allProjects] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllCompanies(),
        storage.getAllProjectsWithDetails(),
      ]);

      const companyMap = new Map(allCompanies.map((c: any) => [c.id, c.name]));

      // Filter to supported roles, approved, non-disabled, non-sandbox
      let filtered = allUsers.filter((u: any) =>
        (u.role === "company_owner" || u.role === "client") &&
        !u.isDisabled &&
        u.isApproved !== false &&
        !u.isSandbox
      );

      if (role === "company_owner") filtered = filtered.filter((u: any) => u.role === "company_owner");
      else if (role === "client") filtered = filtered.filter((u: any) => u.role === "client");

      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter((u: any) =>
          u.name?.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      }

      // Map userId → companyId for contractor-based company derivation (projects have no direct companyId)
      const userCompanyById = new Map(allUsers.map((u: any) => [u.id, u.companyId ?? null]));

      // Enrich each user with company name and project count
      const enriched = filtered.map((user: any) => {
        const { password: _, ...u } = user;
        let relatedCompanyId = u.companyId ?? null;
        let relatedCompanyName = relatedCompanyId ? (companyMap.get(relatedCompanyId) ?? null) : null;
        let projectCount = 0;

        if (u.role === "company_owner") {
          projectCount = allProjects.filter((p: any) => {
            const projectCompanyId = p.contractorId ? userCompanyById.get(p.contractorId) : null;
            return projectCompanyId === relatedCompanyId;
          }).length;
        } else if (u.role === "client") {
          const clientProjects = allProjects.filter((p: any) => p.clientId === u.id);
          projectCount = clientProjects.length;
          if (!relatedCompanyId && clientProjects.length > 0) {
            const firstProjectContractorId = clientProjects[0]?.contractorId ?? null;
            relatedCompanyId = firstProjectContractorId ? (userCompanyById.get(firstProjectContractorId) ?? null) : null;
            relatedCompanyName = relatedCompanyId ? (companyMap.get(relatedCompanyId) ?? null) : null;
          }
        }

        return { ...u, relatedCompanyId, relatedCompanyName, projectCount };
      });

      // Apply company filter after enrichment
      const results = companyId && companyId !== "all"
        ? enriched.filter((r: any) => r.relatedCompanyId === companyId)
        : enriched;

      res.json(results);
    } catch (error) { next(error); }
  });

  // POST /api/admin/view-as — start view-as session (swaps req.user to viewed user)
  app.post("/api/admin/view-as", requireAdmin, async (req, res, next) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const admin = req.user as User;
      const target = await storage.getUser(userId);

      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.id === admin.id) return res.status(400).json({ message: "Cannot view as yourself" });
      if (target.role === "admin") return res.status(403).json({ message: "Cannot view as another admin" });
      if (target.role !== "company_owner" && target.role !== "client") {
        return res.status(403).json({ message: "View As only supports company owners and clients" });
      }
      if (target.isDisabled) return res.status(403).json({ message: "Cannot view as a disabled user" });
      if (target.isApproved === false) return res.status(403).json({ message: "Cannot view as an unapproved user" });

      const targetDashboard = target.role === "company_owner" ? "/company/dashboard" : "/client/dashboard";

      // Store admin identity before swapping session (timestamps for inactivity + hard-cap)
      const sessionStartedAt = Date.now();
      (req.session as any).adminData = { userId: admin.id, startedAt: sessionStartedAt, lastActivityAt: sessionStartedAt };

      // Swap Passport session to viewed user, keeping existing session data (adminData)
      await new Promise<void>((resolve, reject) => {
        req.logIn(target, { session: true, keepSessionInfo: true }, (err: any) => { if (err) reject(err); else resolve(); });
      });

      logAuditEvent(req, admin, {
        action: "view_as_started",
        entityType: "user",
        entityId: target.id,
        entityName: target.name ?? target.username,
        companyId: target.companyId ?? null,
        metadata: {
          viewedUserId: target.id,
          viewedUserEmail: target.email,
          viewedUserRole: target.role,
          viewedUserName: target.name ?? target.username,
          targetDashboard,
        },
      });

      const { password: _, ...targetWithoutPassword } = target;
      res.json({ user: targetWithoutPassword, targetDashboard });
    } catch (error) { next(error); }
  });

  // POST /api/admin/view-as/exit — end view-as session, restore admin
  app.post("/api/admin/view-as/exit", requireViewAsSession, async (req, res, next) => {
    try {
      const session = req.session as any;
      const adminId = session.adminData.userId;
      const admin = await storage.getUser(adminId);
      if (!admin) return res.status(404).json({ message: "Admin user not found" });

      const viewedUser = req.user as User;
      const exitedAt = Date.now();
      const sessionStartedAt = session.adminData.startedAt ?? exitedAt;

      logAuditEvent(req, admin, {
        action: "view_as_ended",
        entityType: "user",
        entityId: viewedUser.id,
        entityName: viewedUser.name ?? viewedUser.username,
        companyId: viewedUser.companyId ?? null,
        metadata: {
          endReason: "manual",
          viewedUserId: viewedUser.id,
          viewedUserEmail: viewedUser.email,
          viewedUserRole: viewedUser.role,
          viewedUserName: viewedUser.name ?? viewedUser.username,
          startedAt: sessionStartedAt,
          endedAt: exitedAt,
          durationMs: exitedAt - sessionStartedAt,
        },
      });

      // Restore admin session; delete adminData first, then swap
      delete session.adminData;
      await new Promise<void>((resolve, reject) => {
        req.logIn(admin, { session: true, keepSessionInfo: true }, (err: any) => { if (err) reject(err); else resolve(); });
      });

      const { password: _, ...adminWithoutPassword } = admin;
      res.json({ user: adminWithoutPassword });
    } catch (error) { next(error); }
  });

  // ── Admin: Audit Log ─────────────────────────────────────────────────────────
  app.get("/api/admin/audit-log/meta", requireAdmin, async (req, res, next) => {
    try {
      const meta = await storage.getAuditLogMeta();
      res.json(meta);
    } catch (error) { next(error); }
  });

  app.get("/api/admin/audit-log", requireAdmin, async (req, res, next) => {
    try {
      const {
        search, action, entityType, companyId,
        startDate, endDate,
        limit: limitStr, offset: offsetStr,
      } = req.query as Record<string, string | undefined>;
      const limit = Math.min(parseInt(limitStr ?? "50", 10) || 50, 200);
      const offset = parseInt(offsetStr ?? "0", 10) || 0;
      const result = await storage.listAuditLogs({
        search: search || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
        companyId: companyId || undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit,
        offset,
      });
      res.json(result);
    } catch (error) { next(error); }
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
  app.get("/api/estimates", requireAuth, requireEstimateAccess, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin" && !user.companyId) {
        return res.status(403).json({ message: "No company associated with your account" });
      }
      const companyId = user.role === "admin" ? undefined : user.companyId!;
      const estimates = await storage.getEstimates(companyId);
      res.json(estimates);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/estimates/:id", requireAuth, requireEstimateAccess, async (req, res, next) => {
    try {
      const user = req.user as User;
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) {
        return res.status(404).json({ message: "Estimate not found" });
      }
      if (user.role !== "admin") {
        if (!user.companyId) {
          return res.status(403).json({ message: "Access denied" });
        }
        // Direct check first (populated on new records after Phase 11B)
        if (estimate.companyId) {
          if (estimate.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          // Legacy fallback: walk project ownership chain for null-companyId records
          if (!estimate.projectId) {
            return res.status(403).json({ message: "Access denied" });
          }
          const project = await storage.getProject(estimate.projectId);
          if (!project?.contractorId) {
            return res.status(403).json({ message: "Access denied" });
          }
          const contractor = await storage.getUser(project.contractorId);
          if (!contractor || contractor.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }
      const lineItems = await storage.getEstimateLineItems(req.params.id);
      res.json({ ...estimate, lineItems });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/estimates/:id/status", requireAuth, requireEstimateAccess, async (req, res, next) => {
    try {
      const VALID_STATUSES = ["draft", "sent", "approved", "declined"];
      const { status } = req.body;
      if (!status || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      const user = req.user as User;
      const estimate = await storage.getEstimate(req.params.id);
      if (!estimate) return res.status(404).json({ message: "Estimate not found" });

      if (user.role !== "admin") {
        if (!user.companyId) return res.status(403).json({ message: "Access denied" });
        if (estimate.companyId) {
          if (estimate.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied: estimate belongs to another company" });
          }
        } else if (estimate.projectId) {
          const project = await storage.getProject(estimate.projectId);
          if (!project?.contractorId) return res.status(403).json({ message: "Access denied" });
          const contractor = await storage.getUser(project.contractorId);
          if (!contractor || contractor.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updated = await storage.updateEstimateStatus(req.params.id, status);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/estimates", requireAuth, requireEstimateAccess, requireActiveSubscription, async (req, res, next) => {
    try {
      // Strip companyId from request body — always derived server-side
      const { companyId: _stripped, ...safeBody } = req.body;
      const parsedEstimate = createEstimateSchema.safeParse(safeBody);
      if (!parsedEstimate.success) {
        return res.status(400).json({ message: "Invalid estimate data", errors: parsedEstimate.error.flatten().fieldErrors });
      }
      const { lineItems, ...estimateData } = parsedEstimate.data;
      const user = req.user as User;
      let derivedCompanyId: string | null = null;
      if (user.role !== "admin") {
        if (estimateData.projectId) {
          // Project-based estimate: validate ownership, derive companyId from project chain
          const project = await storage.getProject(estimateData.projectId);
          if (!project) return res.status(404).json({ message: "Project not found" });
          if (!project.contractorId) {
            return res.status(403).json({ message: "Access denied: cannot verify project ownership" });
          }
          const contractor = await storage.getUser(project.contractorId);
          if (!contractor || contractor.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied: project not in your company" });
          }
          derivedCompanyId = contractor.companyId ?? null;
        } else {
          // Projectless estimate: explicit safety checks regardless of upstream middleware
          if (user.role === "client") {
            return res.status(403).json({ message: "Access denied: clients cannot create estimates" });
          }
          if (user.contractorType === "subcontractor") {
            return res.status(403).json({ message: "Access denied: subcontractors cannot create estimates" });
          }
          if (user.contractorType === "notary") {
            return res.status(403).json({ message: "Access denied: notaries cannot create estimates" });
          }
          if (!user.companyId) {
            return res.status(403).json({ message: "Access denied: no company associated with your account" });
          }
          // Allow: company_owner, isCompanyAdmin contractor, or regular internal contractor (no contractorType)
          const isInternalContractor =
            user.role === "company_owner" ||
            user.isCompanyAdmin === true ||
            (user.role === "contractor" && !user.contractorType);
          if (!isInternalContractor) {
            return res.status(403).json({ message: "Access denied: not an internal company user" });
          }
          derivedCompanyId = user.companyId;
        }
      } else if (estimateData.projectId) {
        // Admin: derive companyId from project chain if possible
        try {
          const project = await storage.getProject(estimateData.projectId);
          if (project?.contractorId) {
            const contractor = await storage.getUser(project.contractorId);
            derivedCompanyId = contractor?.companyId ?? null;
            if (!derivedCompanyId) {
              console.warn(`[create estimate] admin: project ${estimateData.projectId} contractor has no companyId`);
            }
          }
        } catch (err) {
          console.warn(`[create estimate] admin: failed to derive companyId for project ${estimateData.projectId}:`, err);
        }
      }

      // Pre-validate all line items before creating any records.
      // Combines field-shape validation (11G) with priceBookItemId ownership checks (11F).
      // A validation failure here prevents any records from being written.

      // Strict numeric parser — rejects partial matches like "1abc", "Infinity",
      // scientific notation, and empty strings that parseFloat() would silently accept.
      const parseStrictFloat = (raw: unknown): number | null => {
        const s = String(raw).trim();
        if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      };

      type SanitizedLineItem = {
        category: string;
        item: string;
        quantity: string;
        unit: string;
        rate: string;
        total: string;
        priceBookItemId: string | null;
      };
      const sanitizedLineItems: SanitizedLineItem[] = [];

      if (lineItems && Array.isArray(lineItems)) {
        for (let i = 0; i < lineItems.length; i++) {
          const raw = lineItems[i];
          const label = `Line item ${i + 1}`;

          // --- Shape validation ---
          if (!raw.category || typeof raw.category !== "string" || !raw.category.trim()) {
            return res.status(400).json({ message: `${label}: category is required` });
          }
          if (!raw.item || typeof raw.item !== "string" || !raw.item.trim()) {
            return res.status(400).json({ message: `${label}: item description is required` });
          }
          if (!raw.unit || typeof raw.unit !== "string" || !raw.unit.trim()) {
            return res.status(400).json({ message: `${label}: unit is required` });
          }

          const qty = parseStrictFloat(raw.quantity);
          if (qty === null || qty <= 0) {
            return res.status(400).json({ message: `${label}: quantity must be a valid number greater than 0` });
          }

          const rate = parseStrictFloat(raw.rate);
          if (rate === null || rate < 0) {
            return res.status(400).json({ message: `${label}: rate must be a valid number greater than or equal to 0` });
          }

          const total = parseStrictFloat(raw.total);
          if (total === null || total < 0) {
            return res.status(400).json({ message: `${label}: total must be a valid number greater than or equal to 0` });
          }

          // --- Total sanity check (tolerance 0.01 to allow floating-point rounding) ---
          const computed = qty * rate;
          if (Math.abs(total - computed) > 0.01) {
            return res.status(400).json({ message: `${label}: total does not match quantity × rate` });
          }

          // --- priceBookItemId validation (Phase 11F) ---
          let priceBookItemId: string | null = null;
          if (raw.priceBookItemId && typeof raw.priceBookItemId === "string") {
            // Guardrail B: company ownership must be verifiable when linking to a price book item
            if (!derivedCompanyId) {
              return res.status(400).json({
                message: "Cannot link to a price book item: company ownership could not be verified for this project",
              });
            }
            const pbItem = await storage.getBudgetItem(raw.priceBookItemId);
            if (!pbItem) {
              return res.status(400).json({ message: "Invalid priceBookItemId: item not found" });
            }
            if (pbItem.companyId !== derivedCompanyId) {
              return res.status(400).json({ message: "Access denied: priceBookItemId belongs to another company" });
            }
            priceBookItemId = raw.priceBookItemId;
          }

          // Store canonical normalized values — never echo raw client strings into the DB
          sanitizedLineItems.push({
            category: raw.category.trim(),
            item: raw.item.trim(),
            quantity: String(qty),
            unit: raw.unit.trim(),
            rate: String(rate),
            total: String(total),
            priceBookItemId,
          });
        }
      }

      // All validations passed — safe to create records
      const estimate = await storage.createEstimate({ ...estimateData, companyId: derivedCompanyId });

      for (const item of sanitizedLineItems) {
        await storage.createEstimateLineItem({
          estimateId: estimate.id,
          category: item.category,
          item: item.item,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          total: item.total,
          priceBookItemId: item.priceBookItemId,
        });
      }
      
      if (estimate.projectId) {
        const estimateBroadcastCtx = await getProjectBroadcastContext(estimate.projectId, (req.user as User).companyId);
        broadcast({ type: "estimate", projectId: estimate.projectId, ...estimateBroadcastCtx });
      }
      logAuditEvent(req, user, {
        action: "estimate_created",
        entityType: "estimate",
        entityId: estimate.id,
        entityName: estimate.customId,
        companyId: estimate.companyId,
        projectId: estimate.projectId,
        metadata: {
          customId: estimate.customId,
          projectName: estimate.projectName,
          clientName: estimate.clientName,
          amount: estimate.amount,
          status: estimate.status,
          lineItemCount: lineItems?.length ?? 0,
        },
      });
      res.json(estimate);
    } catch (error) {
      next(error);
    }
  });

  // Invoice routes
  app.get("/api/invoices", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin" && !user.companyId) {
        return res.status(403).json({ message: "No company associated with your account" });
      }
      const companyId = user.role === "admin" ? undefined : user.companyId!;
      const invoices = await storage.getInvoices(companyId);
      res.json(invoices);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (user.role !== "admin") {
        if (!user.companyId) {
          return res.status(403).json({ message: "Access denied" });
        }
        // Direct check first (populated on new records after Phase 11B)
        if (invoice.companyId) {
          if (invoice.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          // Legacy fallback: walk project ownership chain for null-companyId records
          if (!invoice.projectId) {
            return res.status(403).json({ message: "Access denied" });
          }
          const project = await storage.getProject(invoice.projectId);
          if (!project?.contractorId) {
            return res.status(403).json({ message: "Access denied" });
          }
          const contractor = await storage.getUser(project.contractorId);
          if (!contractor || contractor.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }
      const lineItems = await storage.getInvoiceLineItems(req.params.id);
      res.json({ ...invoice, lineItems });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/invoices/:id", requireAuth, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;

      // Only company_owner, isCompanyAdmin contractors, and admins may edit invoices
      if (user.role === "client") {
        return res.status(403).json({ message: "Access denied" });
      }
      if (user.role === "contractor") {
        if (user.contractorType === "subcontractor" || user.contractorType === "notary") {
          return res.status(403).json({ message: "Access denied" });
        }
        if (!user.isCompanyAdmin) {
          return res.status(403).json({ message: "Access denied: company admin required" });
        }
      }

      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Verify ownership for non-admins
      if (user.role !== "admin") {
        if (!user.companyId) {
          return res.status(403).json({ message: "Access denied" });
        }
        // Direct check first (populated on new records after Phase 11B)
        if (invoice.companyId) {
          if (invoice.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          // Legacy fallback: walk project ownership chain for null-companyId records
          if (!invoice.projectId) {
            return res.status(403).json({ message: "Access denied" });
          }
          const project = await storage.getProject(invoice.projectId);
          if (!project?.contractorId) {
            return res.status(403).json({ message: "Access denied" });
          }
          const contractor = await storage.getUser(project.contractorId);
          if (!contractor || contractor.companyId !== user.companyId) {
            return res.status(403).json({ message: "Access denied" });
          }
        }
      }

      const oldStatus = invoice.status;
      const oldDueDate = invoice.dueDate;

      // Strip companyId from body — never allow client to set it
      const { companyId: _stripped, ...safeBody } = req.body;
      const updateSchema = z.object({
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD").optional(),
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
      });

      const parsed = updateSchema.safeParse(safeBody);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten().fieldErrors });
      }

      const updated = await storage.updateInvoice(req.params.id, parsed.data);
      if (!updated) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.projectId) {
        const ctx = await getProjectBroadcastContext(invoice.projectId, user.companyId);
        broadcast({ type: "invoice", projectId: invoice.projectId, ...ctx });
      }

      logAuditEvent(req, user, {
        action: "invoice_updated",
        entityType: "invoice",
        entityId: updated.id,
        entityName: updated.customId,
        companyId: updated.companyId,
        projectId: updated.projectId,
        metadata: {
          oldStatus,
          newStatus: updated.status,
          oldDueDate,
          newDueDate: updated.dueDate,
          amount: updated.amount,
        },
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/invoices", requireAuth, requireActiveSubscription, async (req, res, next) => {
    try {
      // Strip companyId from request body — always derived server-side
      const { companyId: _stripped, ...safeBody } = req.body;
      const parsedInvoice = createInvoiceSchema.safeParse(safeBody);
      if (!parsedInvoice.success) {
        return res.status(400).json({ message: "Invalid invoice data", errors: parsedInvoice.error.flatten().fieldErrors });
      }
      const { lineItems, ...invoiceData } = parsedInvoice.data;
      const user = req.user as User;
      let derivedCompanyId: string | null = null;
      if (user.role !== "admin") {
        if (!invoiceData.projectId) {
          return res.status(403).json({ message: "Access denied: a project must be associated with this invoice" });
        }
        const project = await storage.getProject(invoiceData.projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (!project.contractorId) {
          return res.status(403).json({ message: "Access denied: cannot verify project ownership" });
        }
        const contractor = await storage.getUser(project.contractorId);
        if (!contractor || contractor.companyId !== user.companyId) {
          return res.status(403).json({ message: "Access denied: project not in your company" });
        }
        derivedCompanyId = contractor.companyId ?? null;
      } else if (invoiceData.projectId) {
        // Admin: derive companyId from project chain if possible
        try {
          const project = await storage.getProject(invoiceData.projectId);
          if (project?.contractorId) {
            const contractor = await storage.getUser(project.contractorId);
            derivedCompanyId = contractor?.companyId ?? null;
            if (!derivedCompanyId) {
              console.warn(`[create invoice] admin: project ${invoiceData.projectId} contractor has no companyId`);
            }
          }
        } catch (err) {
          console.warn(`[create invoice] admin: failed to derive companyId for project ${invoiceData.projectId}:`, err);
        }
      }
      const invoice = await storage.createInvoice({ ...invoiceData, companyId: derivedCompanyId });
      
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
      logAuditEvent(req, user, {
        action: "invoice_created",
        entityType: "invoice",
        entityId: invoice.id,
        entityName: invoice.customId,
        companyId: invoice.companyId,
        projectId: invoice.projectId,
        metadata: {
          customId: invoice.customId,
          projectName: invoice.projectName,
          clientName: invoice.clientName,
          amount: invoice.amount,
          status: invoice.status,
          dueDate: invoice.dueDate,
          lineItemCount: lineItems?.length ?? 0,
        },
      });
      res.json(invoice);
    } catch (error) {
      next(error);
    }
  });

  // Recurring billing routes
  app.get("/api/recurring-billing", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (user.role !== "admin" && !user.companyId) {
        return res.status(403).json({ message: "No company associated with your account" });
      }
      const companyId = user.role === "admin" ? undefined : user.companyId!;
      const billing = await storage.getRecurringBilling(companyId);
      res.json(billing);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/recurring-billing", requireAuth, async (req, res, next) => {
    try {
      // Strip companyId from request body — always derived server-side
      const { companyId: _stripped, ...safeBody } = req.body;
      const parsedBilling = createRecurringBillingSchema.safeParse(safeBody);
      if (!parsedBilling.success) {
        return res.status(400).json({ message: "Invalid recurring billing data", errors: parsedBilling.error.flatten().fieldErrors });
      }
      const user = req.user as User;
      let derivedCompanyId: string | null = null;
      if (user.role !== "admin") {
        const billingProjectId = parsedBilling.data.projectId;
        if (!billingProjectId) {
          return res.status(403).json({ message: "Access denied: a project must be associated with this billing record" });
        }
        const project = await storage.getProject(billingProjectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        if (!project.contractorId) {
          return res.status(403).json({ message: "Access denied: cannot verify project ownership" });
        }
        const contractor = await storage.getUser(project.contractorId);
        if (!contractor || contractor.companyId !== user.companyId) {
          return res.status(403).json({ message: "Access denied: project not in your company" });
        }
        derivedCompanyId = contractor.companyId ?? null;
      } else if (parsedBilling.data.projectId) {
        // Admin: derive companyId from project chain if possible
        try {
          const project = await storage.getProject(parsedBilling.data.projectId);
          if (project?.contractorId) {
            const contractor = await storage.getUser(project.contractorId);
            derivedCompanyId = contractor?.companyId ?? null;
            if (!derivedCompanyId) {
              console.warn(`[create recurring-billing] admin: project ${parsedBilling.data.projectId} contractor has no companyId`);
            }
          }
        } catch (err) {
          console.warn(`[create recurring-billing] admin: failed to derive companyId for project ${parsedBilling.data.projectId}:`, err);
        }
      }
      const billing = await storage.createRecurringBilling({ ...parsedBilling.data, companyId: derivedCompanyId });
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

  // Returns clients for the caller's company, scoped by projects they are attached to.
  // Only role==="client" users are returned — admins, contractors, etc. are excluded.
  // Company scoping: derived from projects.clientId for the caller's company (no dedicated
  // company-client association table exists; a full client-company join table would be needed
  // for a complete solution in a future task).
  // Admins see all clients system-wide (unchanged behaviour for super-admin tooling).
  app.get("/api/users/clients", requireAuth, async (req, res, next) => {
    try {
      const caller = req.user as User;
      const includeSandbox = req.query.includeSandbox === "true";
      const allClients = await storage.getUsersByRole("client");
      const filtered = includeSandbox ? allClients : allClients.filter(u => !u.isSandbox);

      if (caller.role === "admin") {
        // Super-admins see every client
        return res.json(filtered.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role })));
      }

      // Company users: scope to clients already attached to their company's projects
      if (!caller.companyId) {
        return res.json([]);
      }
      const companyProjects = await storage.getProjectsByCompanyId(caller.companyId);
      const linkedClientIds = new Set(
        companyProjects.map(p => p.clientId).filter(Boolean)
      );
      const companyClients = filtered.filter(u => linkedClientIds.has(u.id));
      res.json(companyClients.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role })));
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

  app.get("/api/company/price-book/categories", requireInternalCompanyMember, async (req, res, next) => {
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

  app.get("/api/company/price-book/items", requireInternalCompanyMember, async (req, res, next) => {
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

      // Only platform admins or company members of the project's company may send invites.
      // The project's company is derived from the assigned contractor's companyId (projects have no
      // direct companyId column in the current schema — this is the canonical company link).
      const isAdmin = user.role === "admin";
      let projectCompanyId: string | null = null;
      if (!isAdmin && project.contractorId) {
        const projectContractor = await storage.getUser(project.contractorId);
        projectCompanyId = projectContractor?.companyId ?? null;
      }
      const isSameCompany = !!(projectCompanyId && user.companyId && user.companyId === projectCompanyId);
      const isAuthorized = isAdmin || (isSameCompany && (user.role === "company_owner" || user.isCompanyAdmin || user.role === "contractor"));
      if (!isAuthorized) {
        return res.status(403).json({ message: "You are not authorized to send invitations for this project." });
      }

      // Expire any existing pending invites for this email on this project
      const existingInvites = await storage.getProjectInvitesByProjectId(req.params.projectId);
      for (const existing of existingInvites) {
        if (existing.email.toLowerCase() === email.toLowerCase() && existing.status === "pending") {
          await storage.updateProjectInvite(existing.id, { status: "expired" });
        }
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

      // Check if email belongs to an existing user
      const invitedUser = await storage.getUserByEmail(email);

      // Send invite email
      try {
        await sendProjectInviteEmail(email, {
          projectName: project.name,
          contractorName: user.name || user.username,
          inviteToken: token,
          clientName: clientName ?? undefined,
          isExistingUser: !!invitedUser,
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
      const user = req.user as User;

      // Only platform admins or company members of the project's company may view invites.
      // The project's company is derived from the assigned contractor's companyId (projects have no
      // direct companyId column in the current schema — this is the canonical company link).
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      const isAdmin = user.role === "admin";
      let projectCompanyId: string | null = null;
      if (!isAdmin && project.contractorId) {
        const projectContractor = await storage.getUser(project.contractorId);
        projectCompanyId = projectContractor?.companyId ?? null;
      }
      const isSameCompany = !!(projectCompanyId && user.companyId && user.companyId === projectCompanyId);
      const isAuthorized = isAdmin || (isSameCompany && (user.role === "company_owner" || user.isCompanyAdmin || user.role === "contractor"));
      if (!isAuthorized) {
        return res.status(403).json({ message: "You are not authorized to view invitations for this project." });
      }

      const invites = await storage.getProjectInvitesByProjectId(req.params.projectId);
      res.json(invites.map(inv => ({
        ...inv,
        status: effectiveStatus(inv.status, inv.expiresAt),
      })));
    } catch (error) {
      next(error);
    }
  });

  // ── Resend a client/project invite (company-safe) ──────────────────────────
  app.post("/api/projects/:projectId/invites/:inviteId/resend", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const isAdmin = user.role === "admin";
      let projectCompanyId: string | null = null;
      if (project.contractorId) {
        const projectContractor = await storage.getUser(project.contractorId);
        projectCompanyId = projectContractor?.companyId ?? null;
      }
      const isSameCompany = !!(projectCompanyId && user.companyId && user.companyId === projectCompanyId);
      const isAuthorized = isAdmin || (isSameCompany && (user.role === "company_owner" || user.isCompanyAdmin === true));
      if (!isAuthorized) {
        return res.status(403).json({ message: "You are not authorized to manage invitations for this project." });
      }

      const invite = await storage.getProjectInviteById(req.params.inviteId);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.projectId !== req.params.projectId) return res.status(404).json({ message: "Invite not found" });

      const currentStatus = effectiveStatus(invite.status, invite.expiresAt);
      if (currentStatus === "accepted") return res.status(400).json({ message: "Cannot resend an accepted invitation." });
      if (currentStatus === "revoked") return res.status(400).json({ message: "Cannot resend a revoked invitation." });

      const crypto = await import("crypto");
      const newToken = crypto.randomBytes(32).toString("hex");
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const updated = await storage.updateProjectInvite(req.params.inviteId, {
        token: newToken,
        status: "pending",
        expiresAt: newExpiresAt,
        resendCount: (invite.resendCount ?? 0) + 1,
        lastResentAt: now,
      });

      const contractorUser = project.contractorId ? await storage.getUser(project.contractorId) : null;
      const contractorName = (user.name || user.username) ?? (contractorUser?.name || contractorUser?.username) ?? "Near Me Construct";
      const existingUser = await storage.getUserByEmail(invite.email);

      try {
        const { sendProjectInviteEmail } = await import("./email");
        await sendProjectInviteEmail(invite.email, {
          projectName: project.name,
          contractorName,
          inviteToken: newToken,
          clientName: invite.clientName ?? undefined,
          isExistingUser: !!existingUser,
        });
      } catch (emailErr) {
        console.error("Failed to send resend invite email (non-fatal):", emailErr);
      }

      res.json({ success: true, invite: updated });
      logAuditEvent(req, user, {
        action: "invite_resent",
        entityType: "invite",
        entityId: invite.id,
        entityName: invite.email,
        companyId: projectCompanyId,
        projectId: req.params.projectId,
        metadata: { email: invite.email, projectName: project.name, inviteKind: "project" },
      });
    } catch (error) { next(error); }
  });

  // ── Revoke a client/project invite (company-safe) ──────────────────────────
  app.post("/api/projects/:projectId/invites/:inviteId/revoke", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const project = await storage.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const isAdmin = user.role === "admin";
      let projectCompanyId: string | null = null;
      if (project.contractorId) {
        const projectContractor = await storage.getUser(project.contractorId);
        projectCompanyId = projectContractor?.companyId ?? null;
      }
      const isSameCompany = !!(projectCompanyId && user.companyId && user.companyId === projectCompanyId);
      const isAuthorized = isAdmin || (isSameCompany && (user.role === "company_owner" || user.isCompanyAdmin === true));
      if (!isAuthorized) {
        return res.status(403).json({ message: "You are not authorized to manage invitations for this project." });
      }

      const invite = await storage.getProjectInviteById(req.params.inviteId);
      if (!invite) return res.status(404).json({ message: "Invite not found" });
      if (invite.projectId !== req.params.projectId) return res.status(404).json({ message: "Invite not found" });

      const currentStatus = effectiveStatus(invite.status, invite.expiresAt);
      if (currentStatus !== "pending") {
        const msg = currentStatus === "accepted" ? "Cannot revoke an accepted invitation."
          : currentStatus === "revoked" ? "This invitation has already been revoked."
          : "Only pending invitations can be revoked.";
        return res.status(400).json({ message: msg });
      }

      const updated = await storage.updateProjectInvite(req.params.inviteId, {
        status: "revoked",
        revokedAt: new Date(),
      });

      res.json({ success: true, invite: updated });
      logAuditEvent(req, user, {
        action: "invite_revoked",
        entityType: "invite",
        entityId: invite.id,
        entityName: invite.email,
        companyId: projectCompanyId,
        projectId: req.params.projectId,
        metadata: { email: invite.email, projectName: project.name, inviteKind: "project" },
      });
    } catch (error) { next(error); }
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

      if (invite.status === "revoked") {
        return res.status(400).json({ message: "This invitation has been cancelled. Please contact your project manager for a new invite." });
      }
      if (invite.status === "accepted") {
        return res.status(400).json({ message: "This invitation has already been accepted." });
      }
      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This invitation is no longer valid." });
      }

      // Get project info
      const project = invite.projectId ? await storage.getProject(invite.projectId) : null;

      // Check if the invited email already has an account
      const existingEmailUser = await storage.getUserByEmail(invite.email);

      // Get company name from the inviting user
      let companyName: string | null = null;
      if (invite.invitedBy) {
        const inviter = await storage.getUser(invite.invitedBy);
        if (inviter?.companyId) {
          const company = await storage.getCompany(inviter.companyId);
          companyName = company?.name ?? null;
        }
      }

      res.json({
        email: invite.email,
        clientName: invite.clientName,
        projectName: project?.name,
        projectId: invite.projectId,
        companyName,
        existingUser: !!existingEmailUser,
      });
    } catch (error) {
      next(error);
    }
  });

  // Accept invite via login for existing users
  app.post("/api/invites/:token/login", async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const invite = await storage.getProjectInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: "Invalid invitation" });
      }

      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "This invitation has expired" });
      }

      if (invite.status === "revoked") {
        return res.status(400).json({ message: "This invitation has been cancelled. Please contact your project manager for a new invite." });
      }
      if (invite.status === "accepted") {
        return res.status(400).json({ message: "This invitation has already been accepted. Please log in to your account directly." });
      }
      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This invitation is no longer valid." });
      }

      // Find the user by the submitted email
      const existingUser = await storage.getUserByEmail(email);
      if (!existingUser) {
        return res.status(401).json({ message: "No account found for this email. Please create a new account." });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, existingUser.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      // Enforce that the authenticated user's email matches the invite email
      if (existingUser.email?.toLowerCase() !== invite.email.toLowerCase()) {
        return res.status(403).json({ message: "This invitation was sent to a different email address. Please log in with the account registered to " + invite.email });
      }

      // These project invites are for client accounts only
      if (existingUser.role !== "client") {
        return res.status(403).json({ message: "This project invitation is for client accounts. Contractors and team members are invited through a separate link." });
      }

      // Mark invite accepted
      await storage.acceptProjectInvite(req.params.token, existingUser.id);

      // Attach user to project as client
      if (invite.projectId) {
        await storage.updateProject(invite.projectId, { clientId: existingUser.id });
      }

      // Log user in
      req.login(existingUser, (err) => {
        if (err) return next(err);
        const { password: _, ...userWithoutPassword } = existingUser;
        return res.json({ user: userWithoutPassword, message: "Invitation accepted" });
      });
    } catch (error) {
      next(error);
    }
  });

  // Accept invite and create account
  app.post("/api/invites/:token/accept", async (req, res, next) => {
    try {
      const { username, password, name } = req.body;

      // Validate inputs before touching the DB
      const trimmedUsername = typeof username === "string" ? username.trim() : "";
      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedUsername || trimmedUsername.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters." });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
      }

      const invite = await storage.getProjectInviteByToken(req.params.token);
      if (!invite) {
        return res.status(404).json({ message: "Invalid invitation" });
      }

      if (new Date() > invite.expiresAt) {
        return res.status(400).json({ message: "This invitation has expired" });
      }

      if (invite.status === "revoked") {
        return res.status(400).json({ message: "This invitation has been cancelled. Please contact your project manager for a new invite." });
      }
      if (invite.status === "accepted") {
        return res.status(400).json({ message: "This invitation has already been accepted. Please log in to your account directly." });
      }
      if (invite.status !== "pending") {
        return res.status(400).json({ message: "This invitation is no longer valid." });
      }

      // Block duplicate accounts — if email already has an account, use the login path
      const existingByEmail = await storage.getUserByEmail(invite.email);
      if (existingByEmail) {
        return res.status(409).json({ message: "An account already exists for this email. Please use 'Already Have an Account' to sign in and accept the invitation." });
      }

      // Check if username exists
      const existingByUsername = await storage.getUserByUsername(trimmedUsername);
      if (existingByUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      // Create new client account
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await storage.createUser({
        username: trimmedUsername,
        email: invite.email,
        password: hashedPassword,
        role: "client",
        name: trimmedName || invite.clientName || undefined,
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
  app.post("/api/contractor-requests", async (_req, res) => {
    res.status(410).json({
      message: "Public access requests are no longer accepted. Please contact us to request a demo.",
    });
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
            registerUrl: `${baseUrl}/subcontractor-invite/${token}`,
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
      const user = req.user as User;
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        const project = await storage.getProject(req.params.projectId);
        if (!project) return res.status(404).json({ message: "Project not found" });
        let projectCompanyId: string | null = null;
        if (project.contractorId) {
          const projectContractor = await storage.getUser(project.contractorId);
          projectCompanyId = projectContractor?.companyId ?? null;
        }
        const isSameCompany = !!(projectCompanyId && user.companyId && user.companyId === projectCompanyId);
        if (!isSameCompany) {
          return res.status(403).json({ message: "You are not authorized to view invitations for this project." });
        }
      }
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
      if (invite.status === "revoked") {
        return res.status(400).json({ message: "This invitation has been cancelled. Please contact the company for a new invite." });
      }
      if (invite.status === "accepted") {
        return res.status(400).json({ message: "This invitation has already been accepted." });
      }
      if (invite.status !== 'pending') {
        return res.status(400).json({ message: "This invitation is no longer valid." });
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
      if (invite.status === "revoked") {
        return res.status(400).json({ message: "This invitation has been cancelled. Please contact the company for a new invite." });
      }
      if (invite.status === "accepted") {
        return res.status(400).json({ message: "This invitation has already been accepted." });
      }
      if (invite.status !== 'pending') {
        return res.status(400).json({ message: "This invitation is no longer valid." });
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

  // ── Project Budget Routes ─────────────────────────────────────────────────────
  // Strict numeric parser — rejects "1abc", "Infinity", scientific notation
  const parseStrictBudgetFloat = (raw: unknown): number | null => {
    const s = String(raw).trim();
    if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  // Allowed project budget status values
  const BUDGET_STATUSES = ["draft", "active", "locked"] as const;
  type BudgetStatus = typeof BUDGET_STATUSES[number];
  const isValidBudgetStatus = (s: unknown): s is BudgetStatus =>
    typeof s === "string" && (BUDGET_STATUSES as readonly string[]).includes(s);

  // Helper: resolve company isolation for a project-scoped budget route.
  // Returns the companyId that owns the project, or sends an error response and returns null.
  const resolveBudgetCompanyId = async (req: any, res: any, projectId: string): Promise<string | null> => {
    const user = req.user as User;
    const project = await storage.getProject(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return null;
    }
    if (user.role === "admin") {
      const contractor = project.contractorId ? await storage.getUser(project.contractorId) : null;
      return contractor?.companyId ?? null;
    }
    if (!user.companyId) {
      res.status(403).json({ message: "Access denied" });
      return null;
    }
    const contractor = project.contractorId ? await storage.getUser(project.contractorId) : null;
    if (!contractor || contractor.companyId !== user.companyId) {
      res.status(403).json({ message: "Access denied" });
      return null;
    }
    return user.companyId;
  };

  // GET /api/projects/:projectId/budget
  // Returns { budget, items } or null. Allowed: admin, company_owner, company admin, internal contractor.
  // Blocked: clients, subcontractors, notaries (requireEstimateAccess). Suspended companies blocked (requireActiveSubscription).
  app.get("/api/projects/:projectId/budget", requireAuth, requireEstimateAccess, requireActiveSubscription, async (req, res, next) => {
    try {
      const companyId = await resolveBudgetCompanyId(req, res, req.params.projectId);
      if (companyId === null && !res.headersSent) return res.status(403).json({ message: "Access denied" });
      if (res.headersSent) return;

      const result = await storage.getProjectBudgetWithItems(req.params.projectId);
      if (!result) return res.json(null);
      // Defense-in-depth: verify returned budget companyId matches resolved project company
      const callerUser = req.user as User;
      if (callerUser.role !== "admin" && result.budget.companyId !== companyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/projects/:projectId/budget
  // Creates the budget header. One budget per project (enforced at DB level via unique constraint).
  app.post("/api/projects/:projectId/budget", requireAuth, requireCompanyOwner, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Subcontractors and notaries are explicitly blocked on all budget write routes
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "Access denied" });
      }
      const companyId = await resolveBudgetCompanyId(req, res, req.params.projectId);
      if (companyId === null && !res.headersSent) return res.status(403).json({ message: "Access denied" });
      if (res.headersSent) return;
      if (!companyId) return res.status(400).json({ message: "Could not determine company for this project" });

      // Enforce one budget per project (pre-flight; DB unique constraint is the final guard)
      const existing = await storage.getProjectBudget(req.params.projectId);
      if (existing) {
        return res.status(409).json({ message: "This project already has a budget." });
      }

      // Validate sourceEstimateId — must belong to same company AND this project
      let sourceEstimateId: string | null = null;
      const rawSourceEstimateId = req.body.sourceEstimateId;
      if (rawSourceEstimateId && typeof rawSourceEstimateId === "string") {
        const sourceEstimate = await storage.getEstimate(rawSourceEstimateId);
        if (!sourceEstimate) return res.status(400).json({ message: "sourceEstimateId: estimate not found" });
        if (sourceEstimate.companyId !== companyId) {
          return res.status(403).json({ message: "sourceEstimateId: estimate belongs to another company" });
        }
        if (sourceEstimate.projectId !== req.params.projectId) {
          return res.status(400).json({ message: "sourceEstimateId: estimate must be linked to this project" });
        }
        sourceEstimateId = rawSourceEstimateId;
      }

      const { title, notes } = req.body;
      let { status } = req.body;

      // Validate status allowlist
      if (status !== undefined && !isValidBudgetStatus(status)) {
        return res.status(400).json({ message: `status must be one of: ${BUDGET_STATUSES.join(", ")}` });
      }

      // ── Copy-from-estimate workflow ──────────────────────────────────────────
      if (sourceEstimateId) {
        // 1. Fetch line items
        const lineItems = await storage.getEstimateLineItems(sourceEstimateId);
        if (!lineItems || lineItems.length === 0) {
          return res.status(400).json({ message: "Source estimate has no line items." });
        }

        // 2. Validate every item before any write
        for (let i = 0; i < lineItems.length; i++) {
          const li = lineItems[i];
          const n = i + 1;
          if (!li.category || !li.category.trim()) {
            return res.status(400).json({ message: `Line item ${n}: category is required` });
          }
          if (!li.item || !li.item.trim()) {
            return res.status(400).json({ message: `Line item ${n}: item description is required` });
          }
          if (!li.unit || typeof li.unit !== "string" || !li.unit.trim()) {
            return res.status(400).json({ message: `Line item ${n}: unit is required` });
          }
          const qty = parseFloat(li.quantity ?? "0");
          const rate = parseFloat(li.rate ?? "0");
          const total = parseFloat(li.total ?? "0");
          if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ message: `Line item ${n}: quantity must be greater than 0` });
          }
          if (isNaN(rate) || rate < 0) {
            return res.status(400).json({ message: `Line item ${n}: rate must be 0 or greater` });
          }
          if (isNaN(total) || total < 0) {
            return res.status(400).json({ message: `Line item ${n}: total must be 0 or greater` });
          }
        }

        // 3. Compute totalEstimated from items
        const totalEstimated = lineItems
          .reduce((sum, li) => sum + parseFloat(li.total ?? "0"), 0)
          .toString();

        // 4. Map estimate line items → budget item snapshots (budgetId filled in by storage)
        const itemSnapshots = lineItems.map((li, idx) => ({
          budgetId: "", // placeholder — storage.createBudgetFromEstimate replaces this
          companyId,
          projectId: req.params.projectId,
          sourceEstimateItemId: li.id,
          priceBookItemId: li.priceBookItemId ?? null,
          category: li.category,
          description: li.item,
          quantity: li.quantity,
          unit: li.unit.trim(),
          unitCostEstimated: li.rate,
          unitCostActual: null,
          totalEstimated: li.total,
          totalActual: "0",
          notes: null,
          displayOrder: idx,
        }));

        // 5. Build budget header — default status to "active" for estimate-sourced budgets
        const resolvedStatus = isValidBudgetStatus(status) ? status : "active";
        const budgetData = {
          projectId: req.params.projectId,
          companyId,
          sourceEstimateId,
          title: (title && typeof title === "string" && title.trim()) ? title.trim() : "Project Budget",
          status: resolvedStatus,
          totalEstimated,
          totalActual: "0",
          notes: (notes && typeof notes === "string" && notes.trim()) ? notes.trim() : null,
        };

        // 6. Atomic transaction: insert header + items + update projects.budget
        let budget;
        try {
          budget = await storage.createBudgetFromEstimate(budgetData, itemSnapshots);
        } catch (txErr: any) {
          // Secondary guard: unique constraint violation means a concurrent insert beat us
          if (txErr?.code === "23505") {
            return res.status(409).json({ message: "This project already has a budget." });
          }
          throw txErr;
        }

        // 7. Audit after transaction commits — one event, no per-item spam
        logAuditEvent(req, user, {
          action: "project_budget_created",
          entityType: "project_budget",
          entityId: budget.id,
          entityName: budget.title,
          companyId,
          projectId: req.params.projectId,
          metadata: {
            projectId: req.params.projectId,
            budgetId: budget.id,
            sourceEstimateId,
            totalEstimated: budget.totalEstimated,
            itemCount: lineItems.length,
            status: budget.status,
          },
        });

        return res.status(201).json(budget);
      }

      // ── Header-only workflow (no sourceEstimateId) ───────────────────────────
      const budget = await storage.createProjectBudget({
        projectId: req.params.projectId,
        companyId,
        sourceEstimateId: null,
        title: (title && typeof title === "string" && title.trim()) ? title.trim() : "Project Budget",
        status: isValidBudgetStatus(status) ? status : "draft",
        totalEstimated: "0",
        totalActual: "0",
        notes: (notes && typeof notes === "string" && notes.trim()) ? notes.trim() : null,
      });

      logAuditEvent(req, user, {
        action: "project_budget_created",
        entityType: "project_budget",
        entityId: budget.id,
        entityName: budget.title,
        companyId,
        projectId: req.params.projectId,
        metadata: {
          projectId: req.params.projectId,
          budgetId: budget.id,
          totalEstimated: budget.totalEstimated,
          status: budget.status,
        },
      });

      res.status(201).json(budget);
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/projects/:projectId/budget
  // Updates budget header fields: title, status, notes.
  app.patch("/api/projects/:projectId/budget", requireAuth, requireCompanyOwner, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Subcontractors and notaries are explicitly blocked on all budget write routes
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "Access denied" });
      }
      const budget = await storage.getProjectBudget(req.params.projectId);
      if (!budget) return res.status(404).json({ message: "Budget not found for this project" });

      // Verify company ownership
      if (user.role !== "admin" && (!user.companyId || budget.companyId !== user.companyId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { title, status, notes } = req.body;
      const updateData: Record<string, any> = {};
      if (title !== undefined && typeof title === "string") updateData.title = title.trim();
      if (status !== undefined) {
        if (!isValidBudgetStatus(status)) {
          return res.status(400).json({ message: `status must be one of: ${BUDGET_STATUSES.join(", ")}` });
        }
        updateData.status = status;
      }
      if (notes !== undefined) updateData.notes = notes === null ? null : String(notes).trim();

      const oldStatus = budget.status;
      const updated = await storage.updateProjectBudget(budget.id, updateData);
      if (!updated) return res.status(404).json({ message: "Budget not found" });

      logAuditEvent(req, user, {
        action: "project_budget_updated",
        entityType: "project_budget",
        entityId: budget.id,
        entityName: updated.title,
        companyId: budget.companyId,
        projectId: req.params.projectId,
        metadata: {
          projectId: req.params.projectId,
          budgetId: budget.id,
          totalEstimated: updated.totalEstimated,
          oldStatus,
          newStatus: updated.status,
        },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // POST /api/projects/:projectId/budget/items
  // Adds a budget line item with strict numeric validation.
  app.post("/api/projects/:projectId/budget/items", requireAuth, requireCompanyOwner, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Subcontractors and notaries are explicitly blocked on all budget write routes
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "Access denied" });
      }
      const budget = await storage.getProjectBudget(req.params.projectId);
      if (!budget) return res.status(404).json({ message: "Budget not found for this project. Create a budget first." });

      if (user.role !== "admin" && (!user.companyId || budget.companyId !== user.companyId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const body = req.body;

      // String field validation
      if (!body.category || typeof body.category !== "string" || !body.category.trim()) {
        return res.status(400).json({ message: "category is required" });
      }
      if (!body.description || typeof body.description !== "string" || !body.description.trim()) {
        return res.status(400).json({ message: "description is required" });
      }
      if (!body.unit || typeof body.unit !== "string" || !body.unit.trim()) {
        return res.status(400).json({ message: "unit is required" });
      }

      // Strict numeric validation
      const qty = parseStrictBudgetFloat(body.quantity);
      if (qty === null || qty <= 0) {
        return res.status(400).json({ message: "quantity must be a valid positive number" });
      }
      const unitCostEstimated = parseStrictBudgetFloat(body.unitCostEstimated);
      if (unitCostEstimated === null || unitCostEstimated < 0) {
        return res.status(400).json({ message: "unitCostEstimated must be a valid non-negative number" });
      }
      const totalEstimated = parseStrictBudgetFloat(body.totalEstimated);
      if (totalEstimated === null || totalEstimated < 0) {
        return res.status(400).json({ message: "totalEstimated must be a valid non-negative number" });
      }
      if (Math.abs(totalEstimated - qty * unitCostEstimated) > 0.01) {
        return res.status(400).json({ message: "totalEstimated does not match quantity × unitCostEstimated" });
      }

      // priceBookItemId — verify ownership
      let priceBookItemId: string | null = null;
      if (body.priceBookItemId && typeof body.priceBookItemId === "string") {
        const pbItem = await storage.getBudgetItem(body.priceBookItemId);
        if (!pbItem) return res.status(400).json({ message: "priceBookItemId: item not found" });
        if (pbItem.companyId !== budget.companyId) {
          return res.status(403).json({ message: "priceBookItemId: item belongs to another company" });
        }
        priceBookItemId = body.priceBookItemId;
      }

      // sourceEstimateItemId — verify it belongs to same company AND this exact project
      let sourceEstimateItemId: string | null = null;
      if (body.sourceEstimateItemId && typeof body.sourceEstimateItemId === "string") {
        const lineItem = await storage.getEstimateLineItem(body.sourceEstimateItemId);
        if (!lineItem) return res.status(400).json({ message: "sourceEstimateItemId: estimate line item not found" });
        const parentEstimate = await storage.getEstimate(lineItem.estimateId);
        if (!parentEstimate || parentEstimate.companyId !== budget.companyId) {
          return res.status(403).json({ message: "sourceEstimateItemId: estimate belongs to another company" });
        }
        // projectId must match exactly — null/missing projectId is also rejected
        if (parentEstimate.projectId !== req.params.projectId) {
          return res.status(403).json({ message: "sourceEstimateItemId: estimate must be linked to this project" });
        }
        sourceEstimateItemId = body.sourceEstimateItemId;
      }

      const item = await storage.createProjectBudgetItem({
        budgetId: budget.id,
        companyId: budget.companyId,
        projectId: req.params.projectId,
        sourceEstimateItemId,
        priceBookItemId,
        category: body.category.trim(),
        description: body.description.trim(),
        quantity: String(qty),
        unit: body.unit.trim(),
        unitCostEstimated: String(unitCostEstimated),
        unitCostActual: null,
        totalEstimated: String(totalEstimated),
        totalActual: "0",
        notes: (body.notes && typeof body.notes === "string") ? body.notes.trim() : null,
        displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : 0,
      });

      await storage.recalculateBudgetTotal(budget.id);
      const updatedBudget = await storage.getProjectBudgetById(budget.id);

      logAuditEvent(req, user, {
        action: "project_budget_item_created",
        entityType: "project_budget",
        entityId: budget.id,
        entityName: budget.title,
        companyId: budget.companyId,
        projectId: req.params.projectId,
        metadata: {
          projectId: req.params.projectId,
          budgetId: budget.id,
          itemDescription: item.description,
          category: item.category,
          totalEstimated: updatedBudget?.totalEstimated ?? budget.totalEstimated,
        },
      });

      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  // PATCH /api/projects/:projectId/budget/items/:itemId
  // Updates a budget line item with strict numeric validation.
  app.patch("/api/projects/:projectId/budget/items/:itemId", requireAuth, requireCompanyOwner, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Subcontractors and notaries are explicitly blocked on all budget write routes
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "Access denied" });
      }
      const budget = await storage.getProjectBudget(req.params.projectId);
      if (!budget) return res.status(404).json({ message: "Budget not found for this project" });

      if (user.role !== "admin" && (!user.companyId || budget.companyId !== user.companyId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify item belongs to this budget
      const items = await storage.getProjectBudgetItems(budget.id);
      const existingItem = items.find(i => i.id === req.params.itemId);
      if (!existingItem) return res.status(404).json({ message: "Budget item not found" });

      const body = req.body;
      const updateData: Record<string, any> = {};

      if (body.category !== undefined) {
        if (!body.category || typeof body.category !== "string" || !body.category.trim())
          return res.status(400).json({ message: "category must be a non-empty string" });
        updateData.category = body.category.trim();
      }
      if (body.description !== undefined) {
        if (!body.description || typeof body.description !== "string" || !body.description.trim())
          return res.status(400).json({ message: "description must be a non-empty string" });
        updateData.description = body.description.trim();
      }
      if (body.unit !== undefined) {
        if (!body.unit || typeof body.unit !== "string" || !body.unit.trim())
          return res.status(400).json({ message: "unit must be a non-empty string" });
        updateData.unit = body.unit.trim();
      }
      if (body.notes !== undefined) {
        updateData.notes = body.notes === null ? null : String(body.notes).trim();
      }
      if (body.displayOrder !== undefined && typeof body.displayOrder === "number") {
        updateData.displayOrder = body.displayOrder;
      }

      // Validate numeric fields — use existing values as fallback for unchanged fields
      const rawQty = body.quantity !== undefined ? body.quantity : existingItem.quantity;
      const rawCost = body.unitCostEstimated !== undefined ? body.unitCostEstimated : existingItem.unitCostEstimated;
      const rawTotal = body.totalEstimated !== undefined ? body.totalEstimated : existingItem.totalEstimated;

      const qty = parseStrictBudgetFloat(rawQty);
      if (qty === null || qty <= 0) return res.status(400).json({ message: "quantity must be a valid positive number" });
      const unitCostEstimated = parseStrictBudgetFloat(rawCost);
      if (unitCostEstimated === null || unitCostEstimated < 0) return res.status(400).json({ message: "unitCostEstimated must be a valid non-negative number" });
      const totalEstimated = parseStrictBudgetFloat(rawTotal);
      if (totalEstimated === null || totalEstimated < 0) return res.status(400).json({ message: "totalEstimated must be a valid non-negative number" });
      if (Math.abs(totalEstimated - qty * unitCostEstimated) > 0.01) {
        return res.status(400).json({ message: "totalEstimated does not match quantity × unitCostEstimated" });
      }

      if (body.quantity !== undefined) updateData.quantity = String(qty);
      if (body.unitCostEstimated !== undefined) updateData.unitCostEstimated = String(unitCostEstimated);
      if (body.totalEstimated !== undefined) updateData.totalEstimated = String(totalEstimated);

      // unitCostActual — optional, can be null or a valid non-negative number
      if (body.unitCostActual !== undefined) {
        if (body.unitCostActual === null) {
          updateData.unitCostActual = null;
        } else {
          const actual = parseStrictBudgetFloat(body.unitCostActual);
          if (actual === null || actual < 0) return res.status(400).json({ message: "unitCostActual must be a valid non-negative number" });
          updateData.unitCostActual = String(actual);
        }
      }

      const updated = await storage.updateProjectBudgetItem(req.params.itemId, updateData);
      if (!updated) return res.status(404).json({ message: "Budget item not found" });

      await storage.recalculateBudgetTotal(budget.id);
      const updatedBudget = await storage.getProjectBudgetById(budget.id);

      logAuditEvent(req, user, {
        action: "project_budget_item_updated",
        entityType: "project_budget",
        entityId: budget.id,
        entityName: budget.title,
        companyId: budget.companyId,
        projectId: req.params.projectId,
        metadata: {
          projectId: req.params.projectId,
          budgetId: budget.id,
          itemDescription: updated.description,
          category: updated.category,
          totalEstimated: updatedBudget?.totalEstimated ?? budget.totalEstimated,
        },
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/projects/:projectId/budget/items/:itemId
  // Removes a budget line item and recalculates the budget total.
  app.delete("/api/projects/:projectId/budget/items/:itemId", requireAuth, requireCompanyOwner, requireActiveSubscription, async (req, res, next) => {
    try {
      const user = req.user as User;
      // Subcontractors and notaries are explicitly blocked on all budget write routes
      if (user.role === "contractor" && (user.contractorType === "subcontractor" || user.contractorType === "notary")) {
        return res.status(403).json({ message: "Access denied" });
      }
      const budget = await storage.getProjectBudget(req.params.projectId);
      if (!budget) return res.status(404).json({ message: "Budget not found for this project" });

      if (user.role !== "admin" && (!user.companyId || budget.companyId !== user.companyId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Verify item belongs to this budget
      const items = await storage.getProjectBudgetItems(budget.id);
      const existingItem = items.find(i => i.id === req.params.itemId);
      if (!existingItem) return res.status(404).json({ message: "Budget item not found" });

      await storage.deleteProjectBudgetItem(req.params.itemId);
      await storage.recalculateBudgetTotal(budget.id);
      await storage.recalculateBudgetActualTotal(budget.id);
      const updatedBudget = await storage.getProjectBudgetById(budget.id);

      logAuditEvent(req, user, {
        action: "project_budget_item_deleted",
        entityType: "project_budget",
        entityId: budget.id,
        entityName: budget.title,
        companyId: budget.companyId,
        projectId: req.params.projectId,
        metadata: {
          projectId: req.params.projectId,
          budgetId: budget.id,
          itemDescription: existingItem.description,
          category: existingItem.category,
          totalEstimated: updatedBudget?.totalEstimated ?? budget.totalEstimated,
        },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return httpServer;
}
