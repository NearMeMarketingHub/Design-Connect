import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email"),
  password: text("password").notNull(),
  role: text("role").notNull().default("client"),
  name: text("name"),
  phone: text("phone"),
  companyName: text("company_name"),
  companyType: text("company_type"),
  profilePicture: text("profile_picture"),
  isSandbox: boolean("is_sandbox").default(false),
  isApproved: boolean("is_approved").default(true),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  invitedBy: varchar("invited_by").references(() => users.id),
  invitedUserId: varchar("invited_user_id").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
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
  addedBy: varchar("added_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProjectTeamMemberSchema = createInsertSchema(projectTeamMembers).omit({ id: true, createdAt: true });
export type InsertProjectTeamMember = z.infer<typeof insertProjectTeamMemberSchema>;
export type ProjectTeamMember = typeof projectTeamMembers.$inferSelect;

// Contractor invitations - invite contractors to join the platform and a project
export const contractorInvites = pgTable("contractor_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id), // Optional - may invite to platform only
  email: text("email").notNull(),
  companyName: text("company_name"),
  companyType: text("company_type"), // Their trade/role type
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending, accepted, expired
  invitedBy: varchar("invited_by").references(() => users.id),
  acceptedUserId: varchar("accepted_user_id").references(() => users.id), // Set when invite is accepted
  expiresAt: timestamp("expires_at").notNull(),
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
