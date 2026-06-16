import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies - the central billing/organizational unit for the subscription model
// Each company_owner owns exactly one company; contractors/notaries/subcontractors belong to a company
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logo: text("logo"), // Optional company logo URL/path (object storage)
  primaryColor: text("primary_color"), // Branding: primary color hex (default #1f2937)
  accentColor: text("accent_color"), // Branding: accent color hex (default #d97706)
  quoteFooterText: text("quote_footer_text"), // Branding: footer text on estimate PDFs
  companyPhone: text("company_phone"), // Branding: company phone number
  companyEmail: text("company_email"), // Branding: company contact email
  companyAddress: text("company_address"), // Branding: company mailing/physical address
  companyWebsite: text("company_website"), // Branding: company website URL
  ownerId: varchar("owner_id"), // FK to users — set after user creation (circular dep handled at app layer)
  subscriptionStatus: text("subscription_status").default("free"), // active, free, prepaid, suspended, cancelled, expired (legacy: trialing, past_due)
  trialStartedAt: timestamp("trial_started_at"), // Legacy reference field — not used for access control
  // Billing & access fields (admin-managed)
  billingType: text("billing_type").default("manual"), // manual | free | prepaid | future_in_app
  monthlyPrice: numeric("monthly_price", { precision: 10, scale: 2 }), // Company-specific monthly price
  trialEndsAt: timestamp("trial_ends_at"), // Legacy reference field — not used for access control
  prepaidThroughDate: timestamp("prepaid_through_date"), // For prepaid billing: access guaranteed through
  billingNotes: text("billing_notes"), // Admin notes on billing/access arrangement
  adminNotes: text("admin_notes"), // Internal-only notes about this company/customer
  accessNotes: text("access_notes"), // Short public-facing access note shown to company owner
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // Stripe billing fields — populated by webhook events (Phase 10B+).
  // IMPORTANT: Stripe's API uses "canceled" (one L); our internal stripePaymentStatus
  // uses "cancelled" (two L's) to match the rest of the app.  When mapping Stripe
  // webhook data to this column, explicitly convert Stripe's "canceled" → "cancelled".
  // Internal stripePaymentStatus values: current | past_due | unpaid | cancelled |
  //   incomplete | action_required | not_configured
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  stripePaymentStatus: text("stripe_payment_status"),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end"),
  stripeGraceStartedAt: timestamp("stripe_grace_started_at"),
  stripeGraceEndsAt: timestamp("stripe_grace_ends_at"),
  lastStripeInvoiceId: text("last_stripe_invoice_id"),
  lastPaymentFailureAt: timestamp("last_payment_failure_at"),
  lastPaymentFailureReason: text("last_payment_failure_reason"),
});

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;


export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  password: text("password").notNull(),
  // Top-level roles: admin | company_owner | contractor | client | notary (legacy, maps to contractor subtype)
  role: text("role").notNull().default("client"),
  name: text("name"),
  phone: text("phone"),
  companyName: text("company_name"),   // Display name / legacy field
  companyType: text("company_type"),   // Legacy field kept for backwards compat
  profilePicture: text("profile_picture"),
  isSandbox: boolean("is_sandbox").default(false),
  isApproved: boolean("is_approved").default(true),
  // New fields for company-based architecture
  companyId: varchar("company_id"),    // FK to companies (nullable — admins and clients have no company)
  contractorType: text("contractor_type"), // 'contractor' | 'notary' | 'subcontractor' (only when role='contractor')
  isCompanyAdmin: boolean("is_company_admin").default(false), // For contractorType='contractor': elevated access
  subcontractorSpecialty: text("subcontractor_specialty"), // e.g., 'Plumber', 'Electrician' (for subcontractors)
  isDisabled: boolean("is_disabled").default(false), // Admin-disabled accounts cannot log in
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Company members - join table allowing subcontractors to belong to multiple companies
// Regular contractors/notaries use companyId on the user record; subcontractors use this table
export const companyMembers = pgTable("company_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("active"), // active | inactive
  roleDefinitionId: varchar("role_definition_id"), // optional assigned role template
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export const insertCompanyMemberSchema = createInsertSchema(companyMembers).omit({ id: true, addedAt: true });
export type InsertCompanyMember = z.infer<typeof insertCompanyMemberSchema>;
export type CompanyMember = typeof companyMembers.$inferSelect;

// Contractor role definitions - templates created by platform admins
// These define what permissions a given role/specialty has within the platform
export const contractorRoleDefinitions = pgTable("contractor_role_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),                         // e.g., 'Project Manager', 'Electrician', 'Company Admin'
  type: text("type").notNull(),                         // 'contractor' | 'subcontractor'
  permissions: jsonb("permissions").notNull().default({}), // RolePermissions JSON object
  isDefault: boolean("is_default").default(false),      // Platform-provided defaults
  createdByAdminId: varchar("created_by_admin_id"),     // null for platform defaults
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContractorRoleDefinitionSchema = createInsertSchema(contractorRoleDefinitions).omit({ id: true, createdAt: true });
export type InsertContractorRoleDefinition = z.infer<typeof insertContractorRoleDefinitionSchema>;
export type ContractorRoleDefinition = typeof contractorRoleDefinitions.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  status: text("status").notNull(),
  phase: text("phase").notNull(),
  progress: integer("progress").notNull().default(0),
  budgetStatus: text("budget_status"),
  nextMilestone: text("next_milestone"),
  dueDate: text("due_date"),
  description: text("description"),
  image: text("image"),
  type: text("type"),
  budget: numeric("budget"),
  clientId: varchar("client_id").references(() => users.id),
  contractorId: varchar("contractor_id").references(() => users.id),
  isSandbox: boolean("is_sandbox").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customId: text("custom_id").notNull(),
  clientName: text("client_name").notNull(),
  projectName: text("project_name").notNull(),
  amount: numeric("amount").notNull(),
  status: text("status").notNull(),
  date: text("date").notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  companyId: varchar("company_id").references(() => companies.id),
});

export const insertEstimateSchema = createInsertSchema(estimates).omit({ id: true });
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type Estimate = typeof estimates.$inferSelect;

export const estimateLineItems = pgTable("estimate_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  estimateId: varchar("estimate_id").notNull().references(() => estimates.id),
  category: text("category").notNull(),
  item: text("item").notNull(),
  quantity: numeric("quantity").notNull(),
  unit: text("unit").notNull(),
  rate: numeric("rate").notNull(),
  total: numeric("total").notNull(),
  priceBookItemId: varchar("price_book_item_id").references(() => budgetItems.id),
});

export const insertEstimateLineItemSchema = createInsertSchema(estimateLineItems).omit({ id: true });
export type InsertEstimateLineItem = z.infer<typeof insertEstimateLineItemSchema>;
export type EstimateLineItem = typeof estimateLineItems.$inferSelect;

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customId: text("custom_id").notNull(),
  clientName: text("client_name").notNull(),
  projectName: text("project_name").notNull(),
  amount: numeric("amount").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull(),
  type: text("type").notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  companyId: varchar("company_id").references(() => companies.id),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id),
  description: text("description").notNull(),
  quantity: numeric("quantity").notNull(),
  rate: numeric("rate").notNull(),
  amount: numeric("amount").notNull(),
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({ id: true });
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

export const recurringBilling = pgTable("recurring_billing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customId: text("custom_id").notNull(),
  clientName: text("client_name").notNull(),
  projectName: text("project_name").notNull(),
  amount: numeric("amount").notNull(),
  frequency: text("frequency").notNull(),
  nextRunDate: text("next_run_date").notNull(),
  status: text("status").notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  companyId: varchar("company_id").references(() => companies.id),
});

export const insertRecurringBillingSchema = createInsertSchema(recurringBilling).omit({ id: true });
export type InsertRecurringBilling = z.infer<typeof insertRecurringBillingSchema>;
export type RecurringBilling = typeof recurringBilling.$inferSelect;

export const projectPhases = pgTable("project_phases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  status: text("status").notNull(),
  dateRange: text("date_range").notNull(),
  tasks: text("tasks").array().notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  dueDate: text("due_date"),
});

export const insertProjectPhaseSchema = createInsertSchema(projectPhases).omit({ id: true });
export type InsertProjectPhase = z.infer<typeof insertProjectPhaseSchema>;
export type ProjectPhase = typeof projectPhases.$inferSelect;

export const phaseUpdates = pgTable("phase_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id").notNull().references(() => projectPhases.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  content: text("content").notNull(),
  createdBy: varchar("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPhaseUpdateSchema = createInsertSchema(phaseUpdates).omit({ id: true, createdAt: true });
export type InsertPhaseUpdate = z.infer<typeof insertPhaseUpdateSchema>;
export type PhaseUpdate = typeof phaseUpdates.$inferSelect;

// Milestone tasks - individual tasks within a phase/milestone with optional percentage tracking
export const milestoneTasks = pgTable("milestone_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id").notNull().references(() => projectPhases.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  requiresPercentage: boolean("requires_percentage").notNull().default(false),
  progressPercent: integer("progress_percent").default(0),
  isComplete: boolean("is_complete").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  dueDate: text("due_date"),
});

export const insertMilestoneTaskSchema = createInsertSchema(milestoneTasks).omit({ id: true, createdAt: true });
export type InsertMilestoneTask = z.infer<typeof insertMilestoneTaskSchema>;
export type MilestoneTask = typeof milestoneTasks.$inferSelect;

export const actionItems = pgTable("action_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  assignedTo: text("assigned_to"),
  dueDate: text("due_date"),
  status: text("status").notNull(),
});

export const insertActionItemSchema = createInsertSchema(actionItems).omit({ id: true });
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItems.$inferSelect;

export const inspirationImages = pgTable("inspiration_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  imageUrl: text("image_url").notNull(),
  coverImage: text("cover_image"),
  images: text("images").array(),
  title: text("title").notNull().default(""),
  caption: text("caption"),
  category: text("category"),
  creatorId: varchar("creator_id"),
  creatorName: text("creator_name").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInspirationImageSchema = createInsertSchema(inspirationImages).omit({ id: true, createdAt: true });
export type InsertInspirationImage = z.infer<typeof insertInspirationImageSchema>;
export type InspirationImage = typeof inspirationImages.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderAvatar: text("sender_avatar"),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  attachmentType: text("attachment_type"),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  replyToId: varchar("reply_to_id"),
  replyToSender: text("reply_to_sender"),
  replyToContent: text("reply_to_content"),
  replyToImageUrl: text("reply_to_image_url"),
  replyToImageTitle: text("reply_to_image_title"),
  isSystem: boolean("is_system").default(false),
  readAt: timestamp("read_at"),
  editedAt: timestamp("edited_at"),
  isDeleted: boolean("is_deleted").default(false),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const progressPosts = pgTable("progress_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  caption: text("caption"),
  coverImage: text("cover_image").notNull(),
  images: text("images").array().notNull(),
  creatorId: varchar("creator_id"),
  creatorName: text("creator_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProgressPostSchema = createInsertSchema(progressPosts).omit({ id: true, createdAt: true });
export type InsertProgressPost = z.infer<typeof insertProgressPostSchema>;
export type ProgressPost = typeof progressPosts.$inferSelect;

export const contractorPhotos = pgTable("contractor_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  title: text("title").notNull(),
  caption: text("caption"),
  coverImage: text("cover_image").notNull(),
  images: text("images").array().notNull(),
  creatorId: varchar("creator_id"),
  creatorName: text("creator_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContractorPhotoSchema = createInsertSchema(contractorPhotos).omit({ id: true, createdAt: true });
export type InsertContractorPhoto = z.infer<typeof insertContractorPhotoSchema>;
export type ContractorPhoto = typeof contractorPhotos.$inferSelect;

export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id"),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({ id: true, createdAt: true });
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type PostComment = typeof postComments.$inferSelect;

export const postReactions = pgTable("post_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id"),
  userName: text("user_name").notNull(),
  reactionType: text("reaction_type").notNull().default("like"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPostReactionSchema = createInsertSchema(postReactions).omit({ id: true, createdAt: true });
export type InsertPostReaction = z.infer<typeof insertPostReactionSchema>;
export type PostReaction = typeof postReactions.$inferSelect;

export const budgetCategories = pgTable("budget_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  // null = platform-level reference; set to company id for company-owned categories
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
});

export const insertBudgetCategorySchema = createInsertSchema(budgetCategories).omit({ id: true });
export type InsertBudgetCategory = z.infer<typeof insertBudgetCategorySchema>;
export type BudgetCategory = typeof budgetCategories.$inferSelect;

export const budgetItems = pgTable("budget_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => budgetCategories.id),
  itemType: text("item_type").notNull(),
  description: text("description").notNull(),
  unitType: text("unit_type").notNull(),
  cost: numeric("cost").default("0"),
  burdens: numeric("burdens").default("0"),
  materialFee: numeric("material_fee").default("0"),
  laborRate: numeric("labor_rate").default("0"),
  subRate: numeric("sub_rate").default("0"),
  retailPrice: numeric("retail_price").default("0"),
  notes: text("notes"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").default(true),
  // Denormalized for easy filtering; mirrors the category's companyId
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
});

export const insertBudgetItemSchema = createInsertSchema(budgetItems).omit({ id: true });
export type InsertBudgetItem = z.infer<typeof insertBudgetItemSchema>;
export type BudgetItem = typeof budgetItems.$inferSelect;

// Project invites for client invitation system
export const projectInvites = pgTable("project_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  clientName: text("client_name"),
  status: text("status").notNull().default("pending"), // pending, accepted, expired, revoked
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedUserId: varchar("invited_user_id").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  expiresAt: timestamp("expires_at").notNull(),
  resendCount: integer("resend_count").notNull().default(0),
  lastResentAt: timestamp("last_resent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectInviteSchema = createInsertSchema(projectInvites).omit({ id: true, createdAt: true });
export type InsertProjectInvite = z.infer<typeof insertProjectInviteSchema>;
export type ProjectInvite = typeof projectInvites.$inferSelect;

// Contractor access requests
export const contractorRequests = pgTable("contractor_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  username: text("username").notNull(),
  companyName: text("company_name").notNull(),
  companyType: text("company_type").notNull(),
  email: text("email"),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
});

export const insertContractorRequestSchema = createInsertSchema(contractorRequests).omit({ id: true, createdAt: true, reviewedAt: true, reviewedBy: true });
export type InsertContractorRequest = z.infer<typeof insertContractorRequestSchema>;
export type ContractorRequest = typeof contractorRequests.$inferSelect;

// Project team members - contractors assigned to projects
export const projectTeamMembers = pgTable("project_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  contractorId: varchar("contractor_id").notNull().references(() => users.id),
  role: text("role"), // Their role/trade on this project (e.g., "Electrician", "HVAC")
  isProjectLead: boolean("is_project_lead").default(false), // Project-level admin/lead rights: can invite external members
  addedBy: varchar("added_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  permissions: jsonb("permissions").default({ canViewDocuments: true, canUploadDocuments: false, canViewBudget: false, canViewMessages: true, canPostMessages: false, canViewEstimates: false }), // Per-project permissions for subs/notaries
});

export const insertProjectTeamMemberSchema = createInsertSchema(projectTeamMembers).omit({ id: true, createdAt: true });
export type InsertProjectTeamMember = z.infer<typeof insertProjectTeamMemberSchema>;
export type ProjectTeamMember = typeof projectTeamMembers.$inferSelect;

// Per-project permission keys for external team members (subcontractors and notaries).
// All six keys are intentional product features; canViewEstimates allows selected external
// members to view project estimate line items without exposing full financial data.
export type ExternalMemberPermissions = {
  canViewDocuments: boolean;
  canUploadDocuments: boolean;
  canViewBudget: boolean;
  canViewMessages: boolean;
  canPostMessages: boolean;
  canViewEstimates: boolean; // Intentional: allows controlled estimate visibility for external members
};

export const DEFAULT_SUBCONTRACTOR_PERMISSIONS: ExternalMemberPermissions = {
  canViewDocuments: true,
  canUploadDocuments: false,
  canViewBudget: false,
  canViewMessages: true,
  canPostMessages: false,
  canViewEstimates: false,
};

export const DEFAULT_NOTARY_PERMISSIONS: ExternalMemberPermissions = {
  canViewDocuments: true,
  canUploadDocuments: true,
  canViewBudget: false,
  canViewMessages: true,
  canPostMessages: false,
  canViewEstimates: false,
};

// Contractor invitations - invite contractors/subcontractors to join a company and/or project
export const contractorInvites = pgTable("contractor_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id), // Optional - may invite to platform only
  companyId: varchar("company_id").references(() => companies.id), // Which company this invite is for
  email: text("email").notNull(),
  companyName: text("company_name"),
  companyType: text("company_type"), // Legacy: their trade/role type
  contractorType: text("contractor_type"), // 'contractor' | 'notary' | 'subcontractor'
  subcontractorSpecialty: text("subcontractor_specialty"), // For subcontractor invites
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending, accepted, expired, revoked
  invitedBy: varchar("invited_by").references(() => users.id),
  acceptedUserId: varchar("accepted_user_id").references(() => users.id), // Set when invite is accepted
  acceptedAt: timestamp("accepted_at"),
  revokedAt: timestamp("revoked_at"),
  expiresAt: timestamp("expires_at").notNull(),
  resendCount: integer("resend_count").notNull().default(0),
  lastResentAt: timestamp("last_resent_at"),
  permissions: jsonb("permissions"), // Per-project permissions to apply when invite is accepted
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContractorInviteSchema = createInsertSchema(contractorInvites).omit({ id: true, createdAt: true });
export type InsertContractorInvite = z.infer<typeof insertContractorInviteSchema>;
export type ContractorInvite = typeof contractorInvites.$inferSelect;

// Chat system - conversations within projects
export const chats = pgTable("chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  type: text("type").notNull().default("direct"), // "direct" or "group"
  title: text("title"), // For group chats, e.g., "Team Chat"
  createdById: varchar("created_by_id").references(() => users.id),
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  lastMessageSenderId: varchar("last_message_sender_id").references(() => users.id),
  lastMessageSenderName: text("last_message_sender_name"),
  isDefault: boolean("is_default").default(false), // True for auto-created chats
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatSchema = createInsertSchema(chats).omit({ id: true, createdAt: true });
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chats.$inferSelect;

// Chat participants - who is in each chat
export const chatParticipants = pgTable("chat_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertChatParticipantSchema = createInsertSchema(chatParticipants).omit({ id: true, joinedAt: true });
export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;
export type ChatParticipant = typeof chatParticipants.$inferSelect;

// Chat messages - individual messages in chats
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  senderName: text("sender_name").notNull(),
  senderAvatar: text("sender_avatar"),
  content: text("content").notNull(),
  attachmentType: text("attachment_type"),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  replyToImageUrl: text("reply_to_image_url"),
  replyToImageTitle: text("reply_to_image_title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Message read receipts - tracks who has read each message
export const messageReads = pgTable("message_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => chatMessages.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  readAt: timestamp("read_at").notNull().defaultNow(),
});

export const insertMessageReadSchema = createInsertSchema(messageReads).omit({ id: true, readAt: true });
export type InsertMessageRead = z.infer<typeof insertMessageReadSchema>;
export type MessageRead = typeof messageReads.$inferSelect;

// Notary Profiles - Contact info for recommended notaries (not user accounts, just autofill data)
export const notaryProfiles = pgTable("notary_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  companyName: text("company_name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  notes: text("notes"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotaryProfileSchema = createInsertSchema(notaryProfiles).omit({ id: true, createdAt: true });
export type InsertNotaryProfile = z.infer<typeof insertNotaryProfileSchema>;
export type NotaryProfile = typeof notaryProfiles.$inferSelect;

// Project documents - files uploaded by contractors/admins
export const projectDocuments = pgTable("project_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'contracts', 'plans', 'permits', 'invoices', 'warranties'
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedById: varchar("uploaded_by_id"),
  uploadedByName: text("uploaded_by_name").notNull(),
  requiresSignature: boolean("requires_signature").default(false),
  signatureStatus: text("signature_status"), // null, 'pending_setup', 'pending_signature', 'completed'
  finalDocumentType: text("final_document_type"), // Where to move after signing (contracts, plans, etc.)
  pendingPacketId: varchar("pending_packet_id"), // Link to signing packet while pending
  requiresNotarization: boolean("requires_notarization").default(false),
  notarizationStatus: text("notarization_status"), // null, 'pending', 'awaiting_approval', 'completed', 'rejected'
  notarizationDueDate: text("notarization_due_date"),
  notarizationRejectionReason: text("notarization_rejection_reason"),
  notaryProfileId: varchar("notary_profile_id").references(() => notaryProfiles.id),
  notarizedFileUrl: text("notarized_file_url"), // The uploaded notarized version
  notarizedUploadedById: varchar("notarized_uploaded_by_id"),
  notarizedUploadedByName: text("notarized_uploaded_by_name"),
  notarizedUploadedAt: timestamp("notarized_uploaded_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectDocumentSchema = createInsertSchema(projectDocuments).omit({ id: true, createdAt: true });
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;
export type ProjectDocument = typeof projectDocuments.$inferSelect;

// Document Signing - Signing packets (requests to sign a document)
export const signingPackets = pgTable("signing_packets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  documentId: varchar("document_id").references(() => projectDocuments.id),
  title: text("title").notNull(),
  message: text("message"), // Optional message to recipients
  status: text("status").notNull().default("draft"), // draft, pending, completed, cancelled, expired
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdByName: text("created_by_name").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  signedDocumentUrl: text("signed_document_url"), // Final signed document
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningPacketSchema = createInsertSchema(signingPackets).omit({ id: true, createdAt: true });
export type InsertSigningPacket = z.infer<typeof insertSigningPacketSchema>;
export type SigningPacket = typeof signingPackets.$inferSelect;

// Signing participants - who needs to sign
export const signingParticipants = pgTable("signing_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packetId: varchar("packet_id").notNull().references(() => signingPackets.id),
  userId: varchar("user_id").references(() => users.id), // Can be null for external signers
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("signer"), // signer, viewer, approver
  signingOrder: integer("signing_order").notNull().default(1), // Order in which they sign
  status: text("status").notNull().default("pending"), // pending, viewed, signed, declined
  signatureData: text("signature_data"), // Base64 signature image
  signatureType: text("signature_type"), // 'drawn' or 'typed'
  signedAt: timestamp("signed_at"),
  signerIp: text("signer_ip"),
  signerAgent: text("signer_agent"),
  accessToken: varchar("access_token").default(sql`gen_random_uuid()`), // Unique token for signing link
  viewedAt: timestamp("viewed_at"),
  declinedReason: text("declined_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningParticipantSchema = createInsertSchema(signingParticipants).omit({ id: true, createdAt: true });
export type InsertSigningParticipant = z.infer<typeof insertSigningParticipantSchema>;
export type SigningParticipant = typeof signingParticipants.$inferSelect;

// Signing events - audit trail
export const signingEvents = pgTable("signing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packetId: varchar("packet_id").notNull().references(() => signingPackets.id),
  participantId: varchar("participant_id").references(() => signingParticipants.id),
  eventType: text("event_type").notNull(), // created, sent, viewed, signed, declined, completed, cancelled, reminder_sent
  actorName: text("actor_name"),
  actorEmail: text("actor_email"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningEventSchema = createInsertSchema(signingEvents).omit({ id: true, createdAt: true });
export type InsertSigningEvent = z.infer<typeof insertSigningEventSchema>;
export type SigningEvent = typeof signingEvents.$inferSelect;

// Signing fields - placed signature/date/initials fields on documents
export const signingFields = pgTable("signing_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packetId: varchar("packet_id").notNull().references(() => signingPackets.id),
  participantId: varchar("participant_id").references(() => signingParticipants.id), // Which signer this field is for
  fieldType: text("field_type").notNull(), // 'signature', 'initials', 'date', 'text', 'checkbox'
  pageNumber: integer("page_number").notNull().default(1),
  xPosition: real("x_position").notNull(), // Percentage from left (0-100)
  yPosition: real("y_position").notNull(), // Percentage from top (0-100)
  width: real("width").notNull(), // Percentage of page width
  height: real("height").notNull(), // Percentage of page height
  isRequired: boolean("is_required").default(true),
  label: text("label"), // Optional label for text fields
  value: text("value"), // Filled value after signing
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSigningFieldSchema = createInsertSchema(signingFields).omit({ id: true, createdAt: true });
export type InsertSigningField = z.infer<typeof insertSigningFieldSchema>;
export type SigningField = typeof signingFields.$inferSelect;

// Client Material Items - Items the client is responsible for providing
export const clientMaterialItems = pgTable("client_material_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  dueDate: text("due_date"),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  completedById: varchar("completed_by_id").references(() => users.id),
  completedByName: text("completed_by_name"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientMaterialItemSchema = createInsertSchema(clientMaterialItems).omit({ id: true, createdAt: true });
export type InsertClientMaterialItem = z.infer<typeof insertClientMaterialItemSchema>;
export type ClientMaterialItem = typeof clientMaterialItems.$inferSelect;

// Change Orders - Formal modifications to project scope, budget, or timeline
export const changeOrders = pgTable("change_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  orderNumber: integer("order_number").notNull(), // Sequential number per project (CO-001, CO-002, etc.)
  title: text("title").notNull(),
  description: text("description").notNull(),
  reason: text("reason").notNull(), // client_request, unforeseen_conditions, design_change, code_compliance, other
  costImpact: numeric("cost_impact").notNull().default("0"), // Positive for additions, negative for credits
  timelineImpact: integer("timeline_impact").notNull().default(0), // Days added (positive) or removed (negative)
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdByName: text("created_by_name").notNull(),
  approvedById: varchar("approved_by_id").references(() => users.id),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  signingPacketId: varchar("signing_packet_id").references(() => signingPackets.id), // For e-signature integration
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChangeOrderSchema = createInsertSchema(changeOrders).omit({ id: true, createdAt: true });
export type InsertChangeOrder = z.infer<typeof insertChangeOrderSchema>;
export type ChangeOrder = typeof changeOrders.$inferSelect;

// Password Reset Tokens - Time-limited tokens for self-service password recovery
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 hash of the raw token
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // null = not yet used
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Change Order Line Items - Itemized breakdown of costs in a change order
export const changeOrderLineItems = pgTable("change_order_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  changeOrderId: varchar("change_order_id").notNull().references(() => changeOrders.id),
  description: text("description").notNull(),
  quantity: numeric("quantity").notNull(),
  unit: text("unit").notNull(),
  rate: numeric("rate").notNull(),
  amount: numeric("amount").notNull(),
});

export const insertChangeOrderLineItemSchema = createInsertSchema(changeOrderLineItems).omit({ id: true });
export type InsertChangeOrderLineItem = z.infer<typeof insertChangeOrderLineItemSchema>;
export type ChangeOrderLineItem = typeof changeOrderLineItems.$inferSelect;

// Demo requests - submitted via the /demo page contact form
export const DEMO_REQUEST_STATUSES = ["new", "contacted", "demo_scheduled", "converted", "closed"] as const;
export type DemoRequestStatus = typeof DEMO_REQUEST_STATUSES[number];

export const HUBSPOT_SYNC_STATUSES = ["not_configured", "pending", "synced", "failed"] as const;
export type HubspotSyncStatus = typeof HUBSPOT_SYNC_STATUSES[number];

export const demoRequests = pgTable("demo_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  message: text("message").notNull().default(""),
  status: text("status", { enum: DEMO_REQUEST_STATUSES }).notNull().default("new"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  convertedCompanyId: text("converted_company_id"),
  internalNotes: text("internal_notes"),
  followUpDate: timestamp("follow_up_date"),
  hubspotSyncStatus: text("hubspot_sync_status", { enum: HUBSPOT_SYNC_STATUSES }).notNull().default("not_configured"),
  hubspotContactId: text("hubspot_contact_id"),
  hubspotCompanyId: text("hubspot_company_id"),
  hubspotDealId: text("hubspot_deal_id"),
  hubspotLastSyncedAt: timestamp("hubspot_last_synced_at"),
  hubspotSyncError: text("hubspot_sync_error"),
});

export const insertDemoRequestSchema = createInsertSchema(demoRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;
export type DemoRequest = typeof demoRequests.$inferSelect;

// Platform-wide settings (singleton row, id always = 1)
export const platformSettings = pgTable("platform_settings", {
  id: integer("id").primaryKey().default(1),
  defaultTrialLength: integer("default_trial_days").notNull().default(7), // Legacy — no longer used for access decisions; kept for historical audit records
  manualBillingEnabled: boolean("manual_billing_enabled").notNull().default(true),
  freeAccessEnabled: boolean("free_access_enabled").notNull().default(false),
  prepaidAccessEnabled: boolean("prepaid_access_enabled").notNull().default(false),
  defaultMonthlyPrice: numeric("default_monthly_price", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformSettingsSchema = createInsertSchema(platformSettings).omit({ id: true, updatedAt: true });
export type InsertPlatformSettings = z.infer<typeof insertPlatformSettingsSchema>;
export type PlatformSettings = typeof platformSettings.$inferSelect;

// Audit Log - tracks important Super Admin actions for accountability and troubleshooting
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").notNull(),
  actorName: text("actor_name").notNull(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(), // e.g. company_created, user_approved, invite_revoked
  entityType: text("entity_type").notNull(), // user, company, invite, demo_request, platform
  entityId: varchar("entity_id"),
  entityName: text("entity_name"),
  companyId: varchar("company_id"),
  projectId: varchar("project_id"),
  metadata: jsonb("metadata"), // arbitrary key-value details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Project Budgets — one budget per project, made up of snapshot line items
export const projectBudgets = pgTable("project_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().unique().references(() => projects.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  sourceEstimateId: varchar("source_estimate_id").references(() => estimates.id),
  title: text("title").notNull().default("Project Budget"),
  status: text("status").notNull().default("draft"),
  totalEstimated: numeric("total_estimated").notNull().default("0"),
  totalActual: numeric("total_actual").notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectBudgetSchema = createInsertSchema(projectBudgets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectBudget = z.infer<typeof insertProjectBudgetSchema>;
export type ProjectBudget = typeof projectBudgets.$inferSelect;

// Project Budget Items — snapshot line items belonging to a project budget
export const projectBudgetItems = pgTable("project_budget_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetId: varchar("budget_id").notNull().references(() => projectBudgets.id, { onDelete: "cascade" }),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  sourceEstimateItemId: varchar("source_estimate_item_id").references(() => estimateLineItems.id),
  priceBookItemId: varchar("price_book_item_id").references(() => budgetItems.id),
  category: text("category").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity").notNull(),
  unit: text("unit").notNull(),
  unitCostEstimated: numeric("unit_cost_estimated").notNull(),
  unitCostActual: numeric("unit_cost_actual"),
  totalEstimated: numeric("total_estimated").notNull(),
  totalActual: numeric("total_actual").notNull().default("0"),
  notes: text("notes"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectBudgetItemSchema = createInsertSchema(projectBudgetItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectBudgetItem = z.infer<typeof insertProjectBudgetItemSchema>;
export type ProjectBudgetItem = typeof projectBudgetItems.$inferSelect;

// Expenses — company-scoped job cost tracking
export const EXPENSE_STATUSES = ["pending", "approved", "reimbursed", "rejected", "paid"] as const;
export type ExpenseStatus = typeof EXPENSE_STATUSES[number];

export const EXPENSE_PAYMENT_METHODS = ["cash", "check", "card", "transfer", "other"] as const;

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  projectId: varchar("project_id").references(() => projects.id),
  vendorName: text("vendor_name"),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount").notNull(),
  expenseDate: text("expense_date").notNull(),
  paymentMethod: text("payment_method"),
  receiptUrl: text("receipt_url"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdByName: text("created_by_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
