import { eq, and, or, not, isNull, like, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Secure token hashing utility for signing tokens
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to generate project slug ID
// Format: lowercased name (no spaces/special chars) + MMYYYY
function generateProjectSlug(name: string, date: Date = new Date()): string {
  // Remove special characters and spaces, convert to lowercase
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${cleanName}${month}${year}`;
}
import type {
  User, InsertUser,
  Company, InsertCompany,
  SubscriptionTier, InsertSubscriptionTier,
  CompanyMember, InsertCompanyMember,
  ContractorRoleDefinition, InsertContractorRoleDefinition,
  Project, InsertProject,
  Estimate, InsertEstimate,
  EstimateLineItem, InsertEstimateLineItem,
  Invoice, InsertInvoice,
  InvoiceLineItem, InsertInvoiceLineItem,
  RecurringBilling, InsertRecurringBilling,
  ProjectPhase, InsertProjectPhase,
  PhaseUpdate, InsertPhaseUpdate,
  MilestoneTask, InsertMilestoneTask,
  ActionItem, InsertActionItem,
  InspirationImage, InsertInspirationImage,
  Message, InsertMessage,
  ProgressPost, InsertProgressPost,
  ContractorPhoto, InsertContractorPhoto,
  PostComment, InsertPostComment,
  PostReaction, InsertPostReaction,
  BudgetCategory, InsertBudgetCategory,
  BudgetItem, InsertBudgetItem,
  ProjectInvite, InsertProjectInvite,
  ContractorRequest, InsertContractorRequest,
  ProjectTeamMember, InsertProjectTeamMember,
  ContractorInvite, InsertContractorInvite,
  Chat, InsertChat,
  ChatParticipant, InsertChatParticipant,
  ChatMessage, InsertChatMessage,
  MessageRead, InsertMessageRead,
  ProjectDocument, InsertProjectDocument,
  SigningPacket, InsertSigningPacket,
  SigningParticipant, InsertSigningParticipant,
  SigningEvent, InsertSigningEvent,
  SigningField, InsertSigningField,
  NotaryProfile, InsertNotaryProfile,
  ClientMaterialItem, InsertClientMaterialItem,
  ChangeOrder, InsertChangeOrder,
  ChangeOrderLineItem, InsertChangeOrderLineItem,
  ExternalMemberPermissions,
  DemoRequest, InsertDemoRequest,
  PlatformSettings, InsertPlatformSettings
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsernameOrEmail(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;

  // Password reset token methods
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  getPasswordResetToken(tokenHash: string): Promise<schema.PasswordResetToken | undefined>;
  consumePasswordResetToken(tokenHash: string): Promise<schema.PasswordResetToken | undefined>;
  invalidateUserPasswordResetTokens(userId: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<number>;

  // Project methods
  getProjects(): Promise<Project[]>;
  getProjectsByClientId(clientId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  
  // Estimate methods
  getEstimates(): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | undefined>;
  createEstimate(estimate: InsertEstimate): Promise<Estimate>;
  getEstimateLineItems(estimateId: string): Promise<EstimateLineItem[]>;
  createEstimateLineItem(lineItem: InsertEstimateLineItem): Promise<EstimateLineItem>;
  
  // Invoice methods
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(lineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  
  // Recurring billing methods
  getRecurringBilling(): Promise<RecurringBilling[]>;
  createRecurringBilling(billing: InsertRecurringBilling): Promise<RecurringBilling>;
  
  // Project phase methods
  getProjectPhases(projectId: string): Promise<ProjectPhase[]>;
  getProjectPhase(id: string): Promise<ProjectPhase | undefined>;
  createProjectPhase(phase: InsertProjectPhase): Promise<ProjectPhase>;
  updateProjectPhase(id: string, phase: Partial<InsertProjectPhase>): Promise<ProjectPhase | undefined>;
  recalculateProjectProgress(projectId: string): Promise<void>;
  
  // Phase update methods
  getPhaseUpdates(phaseId: string): Promise<PhaseUpdate[]>;
  getProjectPhaseUpdates(projectId: string): Promise<PhaseUpdate[]>;
  createPhaseUpdate(update: InsertPhaseUpdate): Promise<PhaseUpdate>;
  deletePhaseUpdate(id: string): Promise<void>;
  
  // Milestone task methods
  getMilestoneTasks(phaseId: string): Promise<MilestoneTask[]>;
  getProjectMilestoneTasks(projectId: string): Promise<MilestoneTask[]>;
  getMilestoneTask(id: string): Promise<MilestoneTask | undefined>;
  createMilestoneTask(task: InsertMilestoneTask): Promise<MilestoneTask>;
  updateMilestoneTask(id: string, task: Partial<InsertMilestoneTask>): Promise<MilestoneTask | undefined>;
  deleteMilestoneTask(id: string): Promise<void>;
  completeAllPhaseTasks(phaseId: string): Promise<void>;
  
  // Timeline delay methods
  delayPhase(phaseId: string, delayDays: number, projectId: string): Promise<{ updatedPhases: number; updatedTasks: number; newProjectDueDate?: string }>;
  delayTask(taskId: string, delayDays: number): Promise<{ updatedTasks: number; updatedPhases: number; newProjectDueDate?: string }>;
  
  // Action item methods
  getActionItems(projectId: string): Promise<ActionItem[]>;
  createActionItem(item: InsertActionItem): Promise<ActionItem>;
  updateActionItem(id: string, item: Partial<InsertActionItem>): Promise<ActionItem | undefined>;
  
  // Inspiration image methods
  getInspirationImages(projectId: string): Promise<InspirationImage[]>;
  getInspirationImage(id: string): Promise<InspirationImage | undefined>;
  createInspirationImage(image: InsertInspirationImage): Promise<InspirationImage>;
  deleteInspirationImage(id: string): Promise<void>;
  
  // Message methods
  getMessages(projectId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, content: string): Promise<Message | undefined>;
  deleteMessage(id: string): Promise<Message | undefined>;
  markMessageAsRead(id: string): Promise<Message | undefined>;
  markProjectMessagesAsRead(projectId: string, userId: string): Promise<void>;

  // Progress post methods
  getProgressPosts(projectId: string): Promise<ProgressPost[]>;
  getProgressPost(id: string): Promise<ProgressPost | undefined>;
  createProgressPost(post: InsertProgressPost): Promise<ProgressPost>;
  deleteProgressPost(id: string): Promise<void>;

  // Contractor photo methods (contractor-only photos)
  getContractorPhotos(projectId: string): Promise<ContractorPhoto[]>;
  getContractorPhoto(id: string): Promise<ContractorPhoto | undefined>;
  createContractorPhoto(photo: InsertContractorPhoto): Promise<ContractorPhoto>;
  deleteContractorPhoto(id: string): Promise<void>;

  // Project document methods
  getProjectDocuments(projectId: string): Promise<ProjectDocument[]>;
  getProjectDocumentsByType(projectId: string, type: string): Promise<ProjectDocument[]>;
  getProjectDocument(id: string): Promise<ProjectDocument | undefined>;
  getProjectDocumentByFileUrl(fileUrl: string): Promise<ProjectDocument | undefined>;
  createProjectDocument(doc: InsertProjectDocument): Promise<ProjectDocument>;
  updateProjectDocument(id: string, data: Partial<InsertProjectDocument>): Promise<ProjectDocument | undefined>;
  deleteProjectDocument(id: string): Promise<void>;
  getDocumentsNeedingNotarization(): Promise<ProjectDocument[]>;
  getDocumentsNeedingNotarizationByProject(projectId: string): Promise<ProjectDocument[]>;

  // Notary profile methods
  getNotaryProfiles(createdById: string): Promise<NotaryProfile[]>;
  getNotaryProfile(id: string): Promise<NotaryProfile | undefined>;
  createNotaryProfile(profile: InsertNotaryProfile): Promise<NotaryProfile>;
  updateNotaryProfile(id: string, data: Partial<InsertNotaryProfile>): Promise<NotaryProfile | undefined>;
  deleteNotaryProfile(id: string): Promise<void>;

  // Post comment methods
  getPostComments(postId: string): Promise<PostComment[]>;
  createPostComment(comment: InsertPostComment): Promise<PostComment>;
  deletePostComment(id: string): Promise<void>;

  // Post reaction methods
  getPostReactions(postId: string): Promise<PostReaction[]>;
  createPostReaction(reaction: InsertPostReaction): Promise<PostReaction>;
  deletePostReaction(postId: string, userId: string): Promise<void>;
  getPostReactionByUser(postId: string, userId: string): Promise<PostReaction | undefined>;

  // Admin methods
  getUsersByRole(role: string): Promise<User[]>;
  getAllProjectsWithDetails(): Promise<(Project & { clientName?: string; contractorName?: string; companyName?: string })[]>;
  getPendingContractors(): Promise<User[]>;
  approveContractor(id: string): Promise<User | undefined>;
  rejectContractor(id: string): Promise<void>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getUserByCompanyOwner(companyId: string): Promise<User | undefined>;

  // Sandbox methods
  getSandboxData(): Promise<{ client: User | null; contractor: User | null; project: Project | null }>;
  initializeSandbox(admin: User): Promise<{ client: User; contractor: User; project: Project }>;
  resetSandbox(): Promise<void>;

  // Budget category methods
  getBudgetCategories(): Promise<BudgetCategory[]>;
  getBudgetCategory(id: string): Promise<BudgetCategory | undefined>;
  createBudgetCategory(category: InsertBudgetCategory): Promise<BudgetCategory>;
  updateBudgetCategory(id: string, category: Partial<InsertBudgetCategory>): Promise<BudgetCategory | undefined>;
  deleteBudgetCategory(id: string): Promise<void>;

  // Budget item methods
  getBudgetItems(categoryId: string): Promise<BudgetItem[]>;
  getAllBudgetItems(): Promise<BudgetItem[]>;
  getBudgetItem(id: string): Promise<BudgetItem | undefined>;
  createBudgetItem(item: InsertBudgetItem): Promise<BudgetItem>;
  updateBudgetItem(id: string, item: Partial<InsertBudgetItem>): Promise<BudgetItem | undefined>;
  deleteBudgetItem(id: string): Promise<void>;

  // Company-scoped price book methods
  getCompanyPriceBookCategories(companyId: string): Promise<BudgetCategory[]>;
  getCompanyPriceBookItems(companyId: string): Promise<BudgetItem[]>;
  getCompanyPriceBookItemsByCategory(categoryId: string, companyId: string): Promise<BudgetItem[]>;

  // Project invite methods
  createProjectInvite(invite: InsertProjectInvite): Promise<ProjectInvite>;
  getProjectInviteByToken(token: string): Promise<ProjectInvite | undefined>;
  getProjectInvitesByProjectId(projectId: string): Promise<ProjectInvite[]>;
  updateProjectInvite(id: string, data: Partial<InsertProjectInvite>): Promise<ProjectInvite | undefined>;
  acceptProjectInvite(token: string, userId: string): Promise<ProjectInvite | undefined>;

  // Contractor request methods
  createContractorRequest(request: InsertContractorRequest): Promise<ContractorRequest>;
  getContractorRequests(): Promise<ContractorRequest[]>;
  getPendingContractorRequests(): Promise<ContractorRequest[]>;
  getContractorRequest(id: string): Promise<ContractorRequest | undefined>;
  updateContractorRequest(id: string, data: Partial<ContractorRequest>): Promise<ContractorRequest | undefined>;

  // Project team member methods
  getProjectTeamMembers(projectId: string): Promise<(ProjectTeamMember & { contractor?: User })[]>;
  addProjectTeamMember(member: InsertProjectTeamMember): Promise<ProjectTeamMember>;
  removeProjectTeamMember(id: string): Promise<void>;
  getContractorProjects(contractorId: string): Promise<Project[]>;
  getContractorProjectsWithDetails(contractorId: string): Promise<(Project & { companyName?: string; companyId?: string; companyLogo?: string | null; permissions?: ExternalMemberPermissions | null; membershipId: string })[]>;
  getProjectTeamMemberByContractorAndProject(projectId: string, contractorId: string): Promise<ProjectTeamMember | undefined>;
  updateProjectTeamMemberPermissions(memberId: string, permissions: object): Promise<ProjectTeamMember | undefined>;

  // Contractor invite methods
  createContractorInvite(invite: InsertContractorInvite): Promise<ContractorInvite>;
  getContractorInviteByToken(token: string): Promise<ContractorInvite | undefined>;
  getContractorInvitesByProject(projectId: string): Promise<ContractorInvite[]>;
  getPendingContractorInvites(): Promise<ContractorInvite[]>;
  getPendingContractorInvitesByEmail(email: string): Promise<ContractorInvite[]>;
  updateContractorInvite(id: string, data: Partial<InsertContractorInvite>): Promise<ContractorInvite | undefined>;
  acceptContractorInvite(token: string, userId: string): Promise<ContractorInvite | undefined>;
  
  // Migration methods
  migrateProjectIdsToSlug(): Promise<{ migrated: number; errors: string[] }>;

  // Chat methods
  getProjectChats(projectId: string, userId: string, isAdminOrPM: boolean): Promise<(Chat & { participants: (ChatParticipant & { user?: User })[], unreadCount: number })[]>;
  getChat(chatId: string): Promise<Chat | undefined>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChat(chatId: string, data: Partial<InsertChat>): Promise<Chat | undefined>;

  // Chat participant methods
  getChatParticipants(chatId: string): Promise<(ChatParticipant & { user?: User })[]>;
  addChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant>;
  removeChatParticipant(chatId: string, userId: string): Promise<void>;
  updateChatParticipantReadTime(chatId: string, userId: string): Promise<void>;
  isUserInChat(chatId: string, userId: string): Promise<boolean>;

  // Chat message methods
  getChatMessages(chatId: string, limit?: number, before?: Date): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getUnreadMessageCount(chatId: string, userId: string): Promise<number>;

  // Message read methods
  getMessageReads(messageId: string): Promise<(MessageRead & { user?: User })[]>;
  getChatMessageReads(chatId: string): Promise<(MessageRead & { user?: User })[]>;
  createMessageRead(read: InsertMessageRead): Promise<MessageRead>;
  markMessagesAsRead(chatId: string, userId: string): Promise<void>;

  // Default chat creation
  createDefaultChatsForProject(projectId: string, clientId: string | null, teamMembers: { contractorId: string; role: string | null; name: string; companyName: string | null }[]): Promise<void>;

  // Signing packet methods
  getSigningPackets(projectId: string): Promise<SigningPacket[]>;
  getSigningPacket(id: string): Promise<SigningPacket | undefined>;
  createSigningPacket(packet: InsertSigningPacket): Promise<SigningPacket>;
  updateSigningPacket(id: string, data: Partial<InsertSigningPacket>): Promise<SigningPacket | undefined>;

  // Signing participant methods
  getSigningParticipants(packetId: string): Promise<SigningParticipant[]>;
  getSigningParticipantByToken(token: string): Promise<SigningParticipant | undefined>;
  createSigningParticipant(participant: InsertSigningParticipant): Promise<SigningParticipant>;
  updateSigningParticipant(id: string, data: Partial<SigningParticipant>): Promise<SigningParticipant | undefined>;

  // Signing event methods
  getSigningEvents(packetId: string): Promise<SigningEvent[]>;
  createSigningEvent(event: InsertSigningEvent): Promise<SigningEvent>;

  // Client material item methods
  getClientMaterialItems(projectId: string): Promise<ClientMaterialItem[]>;
  getClientMaterialItem(id: string): Promise<ClientMaterialItem | undefined>;
  createClientMaterialItem(item: InsertClientMaterialItem): Promise<ClientMaterialItem>;
  updateClientMaterialItem(id: string, data: Partial<InsertClientMaterialItem>): Promise<ClientMaterialItem | undefined>;
  deleteClientMaterialItem(id: string): Promise<void>;
  hasClientMaterialItems(projectId: string): Promise<boolean>;

  // Change order methods
  getChangeOrders(projectId: string): Promise<ChangeOrder[]>;
  getChangeOrder(id: string): Promise<ChangeOrder | undefined>;
  createChangeOrder(order: InsertChangeOrder): Promise<ChangeOrder>;
  updateChangeOrder(id: string, data: Partial<InsertChangeOrder>): Promise<ChangeOrder | undefined>;
  deleteChangeOrder(id: string): Promise<void>;
  getNextChangeOrderNumber(projectId: string): Promise<number>;
  getChangeOrderLineItems(changeOrderId: string): Promise<ChangeOrderLineItem[]>;
  createChangeOrderLineItem(item: InsertChangeOrderLineItem): Promise<ChangeOrderLineItem>;
  deleteChangeOrderLineItems(changeOrderId: string): Promise<void>;

  // Company methods
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByOwnerId(ownerId: string): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  createCompanyWithOwner(companyData: InsertCompany, ownerData: InsertUser): Promise<{ company: Company; user: User }>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  // Company member methods
  getCompanyMembers(companyId: string): Promise<(CompanyMember & { user?: User })[]>;
  getCompanyMember(companyId: string, userId: string): Promise<CompanyMember | undefined>;
  addCompanyMember(member: InsertCompanyMember): Promise<CompanyMember>;
  updateCompanyMember(companyId: string, userId: string, data: Partial<InsertCompanyMember>): Promise<CompanyMember | undefined>;
  removeCompanyMember(companyId: string, userId: string): Promise<void>;
  getUserCompanies(userId: string): Promise<(CompanyMember & { company?: Company })[]>;

  // Contractor role definition methods
  getContractorRoleDefinitions(): Promise<ContractorRoleDefinition[]>;
  getContractorRoleDefinition(id: string): Promise<ContractorRoleDefinition | undefined>;
  createContractorRoleDefinition(def: InsertContractorRoleDefinition): Promise<ContractorRoleDefinition>;
  updateContractorRoleDefinition(id: string, data: Partial<InsertContractorRoleDefinition>): Promise<ContractorRoleDefinition | undefined>;
  deleteContractorRoleDefinition(id: string): Promise<void>;

  // Projects by company
  getProjectsByCompanyId(companyId: string): Promise<Project[]>;

  // Subscription tier methods
  getSubscriptionTiers(): Promise<SubscriptionTier[]>;
  getActiveSubscriptionTiers(): Promise<SubscriptionTier[]>;
  getSubscriptionTier(id: string): Promise<SubscriptionTier | undefined>;
  createSubscriptionTier(tier: InsertSubscriptionTier): Promise<SubscriptionTier>;
  updateSubscriptionTier(id: string, data: Partial<InsertSubscriptionTier>): Promise<SubscriptionTier | undefined>;
  deleteSubscriptionTier(id: string): Promise<void>;

  // Demo request methods
  createDemoRequest(data: InsertDemoRequest): Promise<DemoRequest>;
  getDemoRequests(): Promise<DemoRequest[]>;
  getDemoRequest(id: string): Promise<DemoRequest | undefined>;
  updateDemoRequest(id: string, data: Partial<InsertDemoRequest>): Promise<DemoRequest | undefined>;

  // Platform settings methods
  getPlatformSettings(): Promise<PlatformSettings>;
  updatePlatformSettings(data: Partial<InsertPlatformSettings>): Promise<PlatformSettings>;

  // Global invite access (admin)
  getAllContractorInvites(): Promise<ContractorInvite[]>;
  getContractorInviteById(id: string): Promise<ContractorInvite | undefined>;
  getAllProjectInvites(): Promise<ProjectInvite[]>;
  getProjectInviteById(id: string): Promise<ProjectInvite | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async getUserByUsernameOrEmail(identifier: string): Promise<User | undefined> {
    let user = await this.getUserByUsername(identifier);
    if (!user) {
      user = await this.getUserByEmail(identifier);
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db.update(schema.users).set({ password: hashedPassword }).where(eq(schema.users.id, userId));
  }

  // Password reset token methods
  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.insert(schema.passwordResetTokens).values({ userId, tokenHash, expiresAt });
  }

  async getPasswordResetToken(tokenHash: string): Promise<schema.PasswordResetToken | undefined> {
    const [token] = await db.select().from(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.tokenHash, tokenHash));
    return token;
  }

  async consumePasswordResetToken(tokenHash: string): Promise<schema.PasswordResetToken | undefined> {
    const now = new Date();
    const [consumed] = await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(schema.passwordResetTokens.tokenHash, tokenHash),
          isNull(schema.passwordResetTokens.usedAt),
          sql`${schema.passwordResetTokens.expiresAt} > ${now}`
        )
      )
      .returning();
    return consumed;
  }

  async invalidateUserPasswordResetTokens(userId: string): Promise<void> {
    await db.update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResetTokens.userId, userId), isNull(schema.passwordResetTokens.usedAt)));
  }

  async deleteExpiredPasswordResetTokens(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const deleted = await db
      .delete(schema.passwordResetTokens)
      .where(sql`${schema.passwordResetTokens.expiresAt} < ${cutoff}`)
      .returning({ id: schema.passwordResetTokens.id });
    return deleted.length;
  }

  // Project methods
  async getProjects(): Promise<Project[]> {
    return await db.select().from(schema.projects);
  }

  async getProjectsByClientId(clientId: string): Promise<Project[]> {
    return await db.select().from(schema.projects).where(eq(schema.projects.clientId, clientId));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id));
    return project;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    // Generate slug ID from project name
    const baseSlug = generateProjectSlug(insertProject.name);
    
    // Check for existing projects with same base slug to handle collisions
    const existingProjects = await db.select({ id: schema.projects.id })
      .from(schema.projects)
      .where(like(schema.projects.id, `${baseSlug}%`));
    
    let finalId = baseSlug;
    if (existingProjects.length > 0) {
      // Find the highest suffix number
      let maxSuffix = 0;
      for (const proj of existingProjects) {
        if (proj.id === baseSlug) {
          maxSuffix = Math.max(maxSuffix, 1);
        } else {
          const match = proj.id.match(new RegExp(`^${baseSlug}-(\\d+)$`));
          if (match) {
            maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10));
          }
        }
      }
      if (maxSuffix > 0) {
        finalId = `${baseSlug}-${maxSuffix + 1}`;
      }
    }
    
    const [project] = await db.insert(schema.projects).values({
      ...insertProject,
      id: finalId
    } as any).returning();
    return project;
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db.update(schema.projects).set(updateData).where(eq(schema.projects.id, id)).returning();
    return project;
  }

  // Estimate methods
  async getEstimates(): Promise<Estimate[]> {
    return await db.select().from(schema.estimates);
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(schema.estimates).where(eq(schema.estimates.id, id));
    return estimate;
  }

  async createEstimate(insertEstimate: InsertEstimate): Promise<Estimate> {
    const [estimate] = await db.insert(schema.estimates).values(insertEstimate).returning();
    return estimate;
  }

  async getEstimateLineItems(estimateId: string): Promise<EstimateLineItem[]> {
    return await db.select().from(schema.estimateLineItems).where(eq(schema.estimateLineItems.estimateId, estimateId));
  }

  async createEstimateLineItem(insertLineItem: InsertEstimateLineItem): Promise<EstimateLineItem> {
    const [lineItem] = await db.insert(schema.estimateLineItems).values(insertLineItem).returning();
    return lineItem;
  }

  // Invoice methods
  async getInvoices(): Promise<Invoice[]> {
    return await db.select().from(schema.invoices);
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id));
    return invoice;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(schema.invoices).values(insertInvoice).returning();
    return invoice;
  }

  async getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]> {
    return await db.select().from(schema.invoiceLineItems).where(eq(schema.invoiceLineItems.invoiceId, invoiceId));
  }

  async createInvoiceLineItem(insertLineItem: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
    const [lineItem] = await db.insert(schema.invoiceLineItems).values(insertLineItem).returning();
    return lineItem;
  }

  // Recurring billing methods
  async getRecurringBilling(): Promise<RecurringBilling[]> {
    return await db.select().from(schema.recurringBilling);
  }

  async createRecurringBilling(insertBilling: InsertRecurringBilling): Promise<RecurringBilling> {
    const [billing] = await db.insert(schema.recurringBilling).values(insertBilling).returning();
    return billing;
  }

  // Project phase methods
  async getProjectPhases(projectId: string): Promise<ProjectPhase[]> {
    return await db.select().from(schema.projectPhases).where(eq(schema.projectPhases.projectId, projectId)).orderBy(schema.projectPhases.orderIndex);
  }

  async getProjectPhase(id: string): Promise<ProjectPhase | undefined> {
    const [phase] = await db.select().from(schema.projectPhases).where(eq(schema.projectPhases.id, id));
    return phase;
  }

  async createProjectPhase(insertPhase: InsertProjectPhase): Promise<ProjectPhase> {
    const [phase] = await db.insert(schema.projectPhases).values(insertPhase).returning();
    // Auto-recalculate project progress after adding a phase
    await this.recalculateProjectProgress(insertPhase.projectId);
    return phase;
  }

  async updateProjectPhase(id: string, updateData: Partial<InsertProjectPhase>): Promise<ProjectPhase | undefined> {
    const [phase] = await db.update(schema.projectPhases).set(updateData).where(eq(schema.projectPhases.id, id)).returning();
    if (phase) {
      // If phase is marked as completed, also complete all tasks under it
      if (updateData.status?.toLowerCase() === 'completed') {
        await this.completeAllPhaseTasks(id);
      }
      // Auto-recalculate project progress after updating a phase
      await this.recalculateProjectProgress(phase.projectId);
    }
    return phase;
  }

  // Calculate project progress based on task completion within milestones
  async recalculateProjectProgress(projectId: string): Promise<void> {
    const tasks = await this.getProjectMilestoneTasks(projectId);
    
    // If no tasks, fall back to phase-based calculation
    if (tasks.length === 0) {
      const phases = await this.getProjectPhases(projectId);
      if (phases.length === 0) return;
      const completedPhases = phases.filter(p => p.status.toLowerCase() === 'completed').length;
      const progress = Math.round((completedPhases / phases.length) * 100);
      await db.update(schema.projects)
        .set({ progress })
        .where(eq(schema.projects.id, projectId));
      return;
    }
    
    // Calculate progress based on tasks
    // For tasks with percentage tracking, use their progressPercent value
    // For simple tasks, use 100 if complete, 0 if not
    let totalProgress = 0;
    for (const task of tasks) {
      if (task.requiresPercentage) {
        totalProgress += task.progressPercent || 0;
      } else {
        totalProgress += task.isComplete ? 100 : 0;
      }
    }
    
    const progress = Math.round(totalProgress / tasks.length);
    
    await db.update(schema.projects)
      .set({ progress })
      .where(eq(schema.projects.id, projectId));
  }

  // Phase update methods
  async getPhaseUpdates(phaseId: string): Promise<PhaseUpdate[]> {
    return await db.select().from(schema.phaseUpdates)
      .where(eq(schema.phaseUpdates.phaseId, phaseId))
      .orderBy(schema.phaseUpdates.createdAt);
  }

  async getProjectPhaseUpdates(projectId: string): Promise<PhaseUpdate[]> {
    return await db.select().from(schema.phaseUpdates)
      .where(eq(schema.phaseUpdates.projectId, projectId))
      .orderBy(schema.phaseUpdates.createdAt);
  }

  async createPhaseUpdate(update: InsertPhaseUpdate): Promise<PhaseUpdate> {
    const [phaseUpdate] = await db.insert(schema.phaseUpdates).values(update).returning();
    return phaseUpdate;
  }

  async deletePhaseUpdate(id: string): Promise<void> {
    await db.delete(schema.phaseUpdates).where(eq(schema.phaseUpdates.id, id));
  }

  // Milestone task methods
  async getMilestoneTasks(phaseId: string): Promise<MilestoneTask[]> {
    return await db.select().from(schema.milestoneTasks)
      .where(eq(schema.milestoneTasks.phaseId, phaseId))
      .orderBy(schema.milestoneTasks.orderIndex);
  }

  async getProjectMilestoneTasks(projectId: string): Promise<MilestoneTask[]> {
    return await db.select().from(schema.milestoneTasks)
      .where(eq(schema.milestoneTasks.projectId, projectId))
      .orderBy(schema.milestoneTasks.orderIndex);
  }

  async getMilestoneTask(id: string): Promise<MilestoneTask | undefined> {
    const [task] = await db.select().from(schema.milestoneTasks).where(eq(schema.milestoneTasks.id, id));
    return task;
  }

  async createMilestoneTask(task: InsertMilestoneTask): Promise<MilestoneTask> {
    const [milestoneTask] = await db.insert(schema.milestoneTasks).values(task).returning();
    // Recalculate progress when task is added
    if (milestoneTask.projectId) {
      await this.recalculateProjectProgress(milestoneTask.projectId);
    }
    return milestoneTask;
  }

  async updateMilestoneTask(id: string, task: Partial<InsertMilestoneTask>): Promise<MilestoneTask | undefined> {
    const [milestoneTask] = await db.update(schema.milestoneTasks)
      .set(task)
      .where(eq(schema.milestoneTasks.id, id))
      .returning();
    // Recalculate progress when task is updated
    if (milestoneTask?.projectId) {
      await this.recalculateProjectProgress(milestoneTask.projectId);
    }
    return milestoneTask;
  }

  async deleteMilestoneTask(id: string): Promise<void> {
    // Get the task first to know the project ID for recalculation
    const [task] = await db.select().from(schema.milestoneTasks).where(eq(schema.milestoneTasks.id, id));
    await db.delete(schema.milestoneTasks).where(eq(schema.milestoneTasks.id, id));
    // Recalculate progress when task is deleted
    if (task?.projectId) {
      await this.recalculateProjectProgress(task.projectId);
    }
  }
  
  // Mark all tasks under a phase as complete
  async completeAllPhaseTasks(phaseId: string): Promise<void> {
    await db.update(schema.milestoneTasks)
      .set({ isComplete: true, progressPercent: 100 })
      .where(eq(schema.milestoneTasks.phaseId, phaseId));
  }

  // Helper function to add days to a date string
  private addDaysToDate(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }

  // Delay a phase and cascade to all subsequent phases/tasks
  async delayPhase(phaseId: string, delayDays: number, projectId: string): Promise<{ updatedPhases: number; updatedTasks: number; newProjectDueDate?: string }> {
    // Get the phase being delayed
    const [targetPhase] = await db.select().from(schema.projectPhases).where(eq(schema.projectPhases.id, phaseId));
    if (!targetPhase) {
      throw new Error('Phase not found');
    }

    // Get all phases for the project ordered by orderIndex
    const allPhases = await db.select().from(schema.projectPhases)
      .where(eq(schema.projectPhases.projectId, projectId))
      .orderBy(schema.projectPhases.orderIndex);

    // Find phases at or after the target phase's orderIndex
    const phasesToUpdate = allPhases.filter(p => p.orderIndex >= targetPhase.orderIndex);
    
    let updatedPhases = 0;
    let updatedTasks = 0;

    // Update each affected phase's dueDate
    for (const phase of phasesToUpdate) {
      if (phase.dueDate) {
        const newDueDate = this.addDaysToDate(phase.dueDate, delayDays);
        await db.update(schema.projectPhases)
          .set({ dueDate: newDueDate })
          .where(eq(schema.projectPhases.id, phase.id));
        updatedPhases++;
      }

      // Update all tasks in this phase
      const tasks = await db.select().from(schema.milestoneTasks)
        .where(eq(schema.milestoneTasks.phaseId, phase.id));
      
      for (const task of tasks) {
        if (task.dueDate) {
          const newTaskDueDate = this.addDaysToDate(task.dueDate, delayDays);
          await db.update(schema.milestoneTasks)
            .set({ dueDate: newTaskDueDate })
            .where(eq(schema.milestoneTasks.id, task.id));
          updatedTasks++;
        }
      }
    }

    // Update project due date
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
    let newProjectDueDate: string | undefined;
    
    if (project?.dueDate) {
      newProjectDueDate = this.addDaysToDate(project.dueDate, delayDays);
      await db.update(schema.projects)
        .set({ dueDate: newProjectDueDate })
        .where(eq(schema.projects.id, projectId));
    }

    return { updatedPhases, updatedTasks, newProjectDueDate };
  }

  // Delay a task and cascade to all subsequent tasks in the same and later phases
  async delayTask(taskId: string, delayDays: number): Promise<{ updatedTasks: number; updatedPhases: number; newProjectDueDate?: string }> {
    // Get the task being delayed
    const [targetTask] = await db.select().from(schema.milestoneTasks).where(eq(schema.milestoneTasks.id, taskId));
    if (!targetTask) {
      throw new Error('Task not found');
    }

    // Get the phase this task belongs to
    const [targetPhase] = await db.select().from(schema.projectPhases).where(eq(schema.projectPhases.id, targetTask.phaseId));
    if (!targetPhase) {
      throw new Error('Phase not found');
    }

    const projectId = targetTask.projectId;

    // Get all phases for the project ordered by orderIndex
    const allPhases = await db.select().from(schema.projectPhases)
      .where(eq(schema.projectPhases.projectId, projectId))
      .orderBy(schema.projectPhases.orderIndex);

    let updatedTasks = 0;
    let updatedPhases = 0;

    // Process each phase
    for (const phase of allPhases) {
      if (phase.orderIndex < targetPhase.orderIndex) {
        // Skip phases before the target phase
        continue;
      }

      // Get all tasks in this phase
      const tasks = await db.select().from(schema.milestoneTasks)
        .where(eq(schema.milestoneTasks.phaseId, phase.id))
        .orderBy(schema.milestoneTasks.orderIndex);

      let shouldDelayPhase = false;

      for (const task of tasks) {
        // For the target phase, only delay tasks at or after the target task's orderIndex
        // For subsequent phases, delay all tasks
        const shouldDelayTask = phase.orderIndex > targetPhase.orderIndex || 
          (phase.orderIndex === targetPhase.orderIndex && task.orderIndex >= targetTask.orderIndex);

        if (shouldDelayTask && task.dueDate) {
          const newTaskDueDate = this.addDaysToDate(task.dueDate, delayDays);
          await db.update(schema.milestoneTasks)
            .set({ dueDate: newTaskDueDate })
            .where(eq(schema.milestoneTasks.id, task.id));
          updatedTasks++;
          shouldDelayPhase = true;
        }
      }

      // Update the phase's dueDate if any of its tasks were delayed
      if (shouldDelayPhase && phase.dueDate) {
        const newPhaseDueDate = this.addDaysToDate(phase.dueDate, delayDays);
        await db.update(schema.projectPhases)
          .set({ dueDate: newPhaseDueDate })
          .where(eq(schema.projectPhases.id, phase.id));
        updatedPhases++;
      }
    }

    // Update project due date
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
    let newProjectDueDate: string | undefined;
    
    if (project?.dueDate) {
      newProjectDueDate = this.addDaysToDate(project.dueDate, delayDays);
      await db.update(schema.projects)
        .set({ dueDate: newProjectDueDate })
        .where(eq(schema.projects.id, projectId));
    }

    return { updatedTasks, updatedPhases, newProjectDueDate };
  }

  // Action item methods
  async getActionItems(projectId: string): Promise<ActionItem[]> {
    return await db.select().from(schema.actionItems).where(eq(schema.actionItems.projectId, projectId));
  }

  async createActionItem(insertItem: InsertActionItem): Promise<ActionItem> {
    const [item] = await db.insert(schema.actionItems).values(insertItem).returning();
    return item;
  }

  async updateActionItem(id: string, updateData: Partial<InsertActionItem>): Promise<ActionItem | undefined> {
    const [item] = await db.update(schema.actionItems).set(updateData).where(eq(schema.actionItems.id, id)).returning();
    return item;
  }

  // Inspiration image methods
  async getInspirationImages(projectId: string): Promise<InspirationImage[]> {
    return await db.select().from(schema.inspirationImages).where(eq(schema.inspirationImages.projectId, projectId));
  }

  async createInspirationImage(insertImage: InsertInspirationImage): Promise<InspirationImage> {
    const [image] = await db.insert(schema.inspirationImages).values(insertImage).returning();
    return image;
  }

  async getInspirationImage(id: string): Promise<InspirationImage | undefined> {
    const [image] = await db.select().from(schema.inspirationImages).where(eq(schema.inspirationImages.id, id));
    return image;
  }

  async deleteInspirationImage(id: string): Promise<void> {
    await db.delete(schema.inspirationImages).where(eq(schema.inspirationImages.id, id));
  }

  // Message methods
  async getMessages(projectId: string): Promise<Message[]> {
    return await db.select().from(schema.messages).where(eq(schema.messages.projectId, projectId));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(schema.messages).values(insertMessage).returning();
    return message;
  }

  async updateMessage(id: string, content: string): Promise<Message | undefined> {
    const [message] = await db.update(schema.messages)
      .set({ content, editedAt: new Date() })
      .where(eq(schema.messages.id, id))
      .returning();
    return message;
  }

  async deleteMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.update(schema.messages)
      .set({ isDeleted: true })
      .where(eq(schema.messages.id, id))
      .returning();
    return message;
  }

  async markMessageAsRead(id: string): Promise<Message | undefined> {
    const [message] = await db.update(schema.messages)
      .set({ readAt: new Date() })
      .where(eq(schema.messages.id, id))
      .returning();
    return message;
  }

  async markProjectMessagesAsRead(projectId: string, userId: string): Promise<void> {
    await db.update(schema.messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.messages.projectId, projectId),
          not(eq(schema.messages.senderId, userId)),
          isNull(schema.messages.readAt)
        )
      );
  }

  // Progress post methods
  async getProgressPosts(projectId: string): Promise<ProgressPost[]> {
    return await db.select().from(schema.progressPosts).where(eq(schema.progressPosts.projectId, projectId));
  }

  async getProgressPost(id: string): Promise<ProgressPost | undefined> {
    const [post] = await db.select().from(schema.progressPosts).where(eq(schema.progressPosts.id, id));
    return post;
  }

  async createProgressPost(insertPost: InsertProgressPost): Promise<ProgressPost> {
    const [post] = await db.insert(schema.progressPosts).values(insertPost).returning();
    return post;
  }

  async deleteProgressPost(id: string): Promise<void> {
    await db.delete(schema.progressPosts).where(eq(schema.progressPosts.id, id));
  }

  // Contractor photo methods (contractor-only photos)
  async getContractorPhotos(projectId: string): Promise<ContractorPhoto[]> {
    return await db.select().from(schema.contractorPhotos).where(eq(schema.contractorPhotos.projectId, projectId));
  }

  async getContractorPhoto(id: string): Promise<ContractorPhoto | undefined> {
    const [photo] = await db.select().from(schema.contractorPhotos).where(eq(schema.contractorPhotos.id, id));
    return photo;
  }

  async createContractorPhoto(insertPhoto: InsertContractorPhoto): Promise<ContractorPhoto> {
    const [photo] = await db.insert(schema.contractorPhotos).values(insertPhoto).returning();
    return photo;
  }

  async deleteContractorPhoto(id: string): Promise<void> {
    await db.delete(schema.contractorPhotos).where(eq(schema.contractorPhotos.id, id));
  }

  // Project document methods
  async getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
    return await db.select().from(schema.projectDocuments).where(eq(schema.projectDocuments.projectId, projectId));
  }

  async getProjectDocumentsByType(projectId: string, type: string): Promise<ProjectDocument[]> {
    return await db.select().from(schema.projectDocuments).where(
      and(
        eq(schema.projectDocuments.projectId, projectId),
        eq(schema.projectDocuments.type, type)
      )
    );
  }

  async getProjectDocument(id: string): Promise<ProjectDocument | undefined> {
    const [doc] = await db.select().from(schema.projectDocuments).where(eq(schema.projectDocuments.id, id));
    return doc;
  }

  async getProjectDocumentByFileUrl(fileUrl: string): Promise<ProjectDocument | undefined> {
    const [doc] = await db.select().from(schema.projectDocuments).where(eq(schema.projectDocuments.fileUrl, fileUrl));
    return doc;
  }

  async createProjectDocument(insertDoc: InsertProjectDocument): Promise<ProjectDocument> {
    const [doc] = await db.insert(schema.projectDocuments).values(insertDoc).returning();
    return doc;
  }

  async updateProjectDocument(id: string, data: Partial<InsertProjectDocument>): Promise<ProjectDocument | undefined> {
    const [updated] = await db.update(schema.projectDocuments)
      .set(data)
      .where(eq(schema.projectDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteProjectDocument(id: string): Promise<void> {
    await db.delete(schema.projectDocuments).where(eq(schema.projectDocuments.id, id));
  }

  async getDocumentsNeedingNotarization(): Promise<ProjectDocument[]> {
    return await db.select().from(schema.projectDocuments).where(
      and(
        eq(schema.projectDocuments.requiresNotarization, true),
        not(eq(schema.projectDocuments.notarizationStatus, 'completed'))
      )
    );
  }

  async getDocumentsNeedingNotarizationByProject(projectId: string): Promise<ProjectDocument[]> {
    return await db.select().from(schema.projectDocuments).where(
      and(
        eq(schema.projectDocuments.projectId, projectId),
        eq(schema.projectDocuments.requiresNotarization, true)
      )
    );
  }

  async getNotaryProfiles(createdById: string): Promise<NotaryProfile[]> {
    return await db.select().from(schema.notaryProfiles).where(eq(schema.notaryProfiles.createdById, createdById));
  }

  async getNotaryProfile(id: string): Promise<NotaryProfile | undefined> {
    const [profile] = await db.select().from(schema.notaryProfiles).where(eq(schema.notaryProfiles.id, id));
    return profile;
  }

  async createNotaryProfile(profile: InsertNotaryProfile): Promise<NotaryProfile> {
    const [created] = await db.insert(schema.notaryProfiles).values(profile).returning();
    return created;
  }

  async updateNotaryProfile(id: string, data: Partial<InsertNotaryProfile>): Promise<NotaryProfile | undefined> {
    const [updated] = await db.update(schema.notaryProfiles)
      .set(data)
      .where(eq(schema.notaryProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteNotaryProfile(id: string): Promise<void> {
    await db.delete(schema.notaryProfiles).where(eq(schema.notaryProfiles.id, id));
  }

  // Post comment methods
  async getPostComments(postId: string): Promise<PostComment[]> {
    return await db.select().from(schema.postComments).where(eq(schema.postComments.postId, postId));
  }

  async createPostComment(insertComment: InsertPostComment): Promise<PostComment> {
    const [comment] = await db.insert(schema.postComments).values(insertComment).returning();
    return comment;
  }

  async deletePostComment(id: string): Promise<void> {
    await db.delete(schema.postComments).where(eq(schema.postComments.id, id));
  }

  // Post reaction methods
  async getPostReactions(postId: string): Promise<PostReaction[]> {
    return await db.select().from(schema.postReactions).where(eq(schema.postReactions.postId, postId));
  }

  async createPostReaction(insertReaction: InsertPostReaction): Promise<PostReaction> {
    const [reaction] = await db.insert(schema.postReactions).values(insertReaction).returning();
    return reaction;
  }

  async deletePostReaction(postId: string, userId: string): Promise<void> {
    await db.delete(schema.postReactions).where(
      and(
        eq(schema.postReactions.postId, postId),
        eq(schema.postReactions.userId, userId)
      )
    );
  }

  async getPostReactionByUser(postId: string, userId: string): Promise<PostReaction | undefined> {
    const [reaction] = await db.select().from(schema.postReactions).where(
      and(
        eq(schema.postReactions.postId, postId),
        eq(schema.postReactions.userId, userId)
      )
    );
    return reaction;
  }

  // Admin methods
  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(schema.users).where(eq(schema.users.role, role));
  }

  async getAllProjectsWithDetails(): Promise<(Project & { clientName?: string; contractorName?: string; companyName?: string })[]> {
    const projects = await db.select().from(schema.projects);
    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        let clientName: string | undefined;
        let contractorName: string | undefined;
        let companyName: string | undefined;

        if (project.clientId) {
          const client = await this.getUser(project.clientId);
          clientName = client?.name || client?.username;
        }

        if (project.contractorId) {
          const contractor = await this.getUser(project.contractorId);
          contractorName = contractor?.name || contractor?.username;
          if (contractor?.companyId) {
            const company = await this.getCompany(contractor.companyId);
            companyName = company?.name;
          }
        }

        return { ...project, clientName, contractorName, companyName };
      })
    );
    return projectsWithDetails;
  }

  async getPendingContractors(): Promise<User[]> {
    return await db.select().from(schema.users).where(
      and(
        or(
          eq(schema.users.role, "contractor"),
          eq(schema.users.role, "company_owner")
        ),
        eq(schema.users.isApproved, false)
      )
    );
  }

  async approveContractor(id: string): Promise<User | undefined> {
    const [user] = await db.update(schema.users)
      .set({ isApproved: true })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }

  async rejectContractor(id: string): Promise<void> {
    await db.delete(schema.users).where(eq(schema.users.id, id));
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(schema.users)
      .set(data)
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }

  async getUserByCompanyOwner(companyId: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(
      and(eq(schema.users.companyId, companyId), eq(schema.users.role, "company_owner"))
    );
    return user;
  }

  // Sandbox methods
  async getSandboxData(): Promise<{ client: User | null; contractor: User | null; project: Project | null }> {
    const [client] = await db.select().from(schema.users).where(
      and(eq(schema.users.isSandbox, true), eq(schema.users.role, "client"))
    );
    const [contractor] = await db.select().from(schema.users).where(
      and(eq(schema.users.isSandbox, true), eq(schema.users.role, "contractor"))
    );
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.isSandbox, true));
    
    return {
      client: client || null,
      contractor: contractor || null,
      project: project || null
    };
  }

  async initializeSandbox(admin: User): Promise<{ client: User; contractor: User; project: Project }> {
    // Check if sandbox data already exists
    const existing = await this.getSandboxData();
    if (existing.client && existing.contractor && existing.project) {
      return {
        client: existing.client,
        contractor: existing.contractor,
        project: existing.project
      };
    }

    // Create sandbox client with hashed password (not meant to be logged into)
    let client = existing.client;
    if (!client) {
      const hashedPassword = await bcrypt.hash("sandbox_not_for_login", 10);
      const [newClient] = await db.insert(schema.users).values({
        username: "sandbox_client",
        email: "sandbox.client@buildvision.test",
        password: hashedPassword,
        role: "client",
        name: "Test Client",
        isSandbox: true,
      }).returning();
      client = newClient;
    }

    // Create sandbox contractor with hashed password (not meant to be logged into)
    let contractor = existing.contractor;
    if (!contractor) {
      const hashedPassword = await bcrypt.hash("sandbox_not_for_login", 10);
      const [newContractor] = await db.insert(schema.users).values({
        username: "sandbox_contractor",
        email: "sandbox.contractor@buildvision.test",
        password: hashedPassword,
        role: "contractor",
        name: "Test Contractor",
        isSandbox: true,
      }).returning();
      contractor = newContractor;
    }

    // Create sandbox project
    let project = existing.project;
    if (!project) {
      const sandboxSlug = generateProjectSlug("Sandbox Test Project");
      const [newProject] = await db.insert(schema.projects).values({
        id: sandboxSlug,
        name: "Sandbox Test Project",
        address: "123 Test Street, Demo City, ST 12345",
        status: "in_progress",
        phase: "Foundation",
        progress: 35,
        budgetStatus: "on_track",
        nextMilestone: "Framing Inspection",
        dueDate: "2025-03-15",
        description: "This is a sandbox project for testing features. Changes here won't affect real projects.",
        type: "renovation",
        budget: "150000",
        clientId: client.id,
        contractorId: contractor.id,
        isSandbox: true,
      }).returning();
      project = newProject;

      // Create sample project phases
      await db.insert(schema.projectPhases).values([
        {
          projectId: project.id,
          name: "Site Preparation",
          status: "completed",
          dateRange: "Jan 1 - Jan 15, 2025",
          tasks: ["Clear site", "Grade foundation", "Install utilities"]
        },
        {
          projectId: project.id,
          name: "Foundation",
          status: "in_progress",
          dateRange: "Jan 16 - Feb 15, 2025",
          tasks: ["Pour footings", "Install foundation walls", "Waterproofing"]
        },
        {
          projectId: project.id,
          name: "Framing",
          status: "pending",
          dateRange: "Feb 16 - Mar 30, 2025",
          tasks: ["Wall framing", "Roof structure", "Window/door openings"]
        }
      ]);

      // Create sample action items
      await db.insert(schema.actionItems).values([
        {
          projectId: project.id,
          title: "Review foundation plans",
          assignedTo: "Test Client",
          dueDate: "2025-01-20",
          status: "pending"
        },
        {
          projectId: project.id,
          title: "Select finish materials",
          assignedTo: "Test Client",
          dueDate: "2025-02-01",
          status: "pending"
        }
      ]);

      // Create sample welcome message
      await db.insert(schema.messages).values({
        projectId: project.id,
        senderId: contractor.id,
        senderName: "Test Contractor",
        senderAvatar: "TC",
        content: "Welcome to the sandbox project! This is a test environment where you can explore all features without affecting real data.",
        isSystem: false,
      });
    }

    return { client, contractor, project };
  }

  async resetSandbox(): Promise<void> {
    // Get sandbox project first
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.isSandbox, true));
    
    if (project) {
      // Delete related data
      await db.delete(schema.messages).where(eq(schema.messages.projectId, project.id));
      await db.delete(schema.actionItems).where(eq(schema.actionItems.projectId, project.id));
      await db.delete(schema.projectPhases).where(eq(schema.projectPhases.projectId, project.id));
      await db.delete(schema.inspirationImages).where(eq(schema.inspirationImages.projectId, project.id));
      
      // Delete progress posts and their comments/reactions
      const posts = await db.select().from(schema.progressPosts).where(eq(schema.progressPosts.projectId, project.id));
      for (const post of posts) {
        await db.delete(schema.postComments).where(eq(schema.postComments.postId, post.id));
        await db.delete(schema.postReactions).where(eq(schema.postReactions.postId, post.id));
      }
      await db.delete(schema.progressPosts).where(eq(schema.progressPosts.projectId, project.id));
      
      // Delete the project
      await db.delete(schema.projects).where(eq(schema.projects.id, project.id));
    }
    
    // Delete sandbox users
    await db.delete(schema.users).where(eq(schema.users.isSandbox, true));
  }

  // Budget category methods
  async getBudgetCategories(): Promise<BudgetCategory[]> {
    return await db.select().from(schema.budgetCategories)
      .where(isNull(schema.budgetCategories.companyId))
      .orderBy(schema.budgetCategories.displayOrder);
  }

  async getBudgetCategory(id: string): Promise<BudgetCategory | undefined> {
    const [category] = await db.select().from(schema.budgetCategories).where(eq(schema.budgetCategories.id, id));
    return category;
  }

  async createBudgetCategory(insertCategory: InsertBudgetCategory): Promise<BudgetCategory> {
    const [category] = await db.insert(schema.budgetCategories).values(insertCategory).returning();
    return category;
  }

  async updateBudgetCategory(id: string, updateData: Partial<InsertBudgetCategory>): Promise<BudgetCategory | undefined> {
    const [category] = await db.update(schema.budgetCategories).set(updateData).where(eq(schema.budgetCategories.id, id)).returning();
    return category;
  }

  async deleteBudgetCategory(id: string): Promise<void> {
    await db.delete(schema.budgetItems).where(eq(schema.budgetItems.categoryId, id));
    await db.delete(schema.budgetCategories).where(eq(schema.budgetCategories.id, id));
  }

  // Budget item methods
  async getBudgetItems(categoryId: string): Promise<BudgetItem[]> {
    return await db.select().from(schema.budgetItems).where(eq(schema.budgetItems.categoryId, categoryId)).orderBy(schema.budgetItems.displayOrder);
  }

  async getAllBudgetItems(): Promise<BudgetItem[]> {
    return await db.select().from(schema.budgetItems)
      .where(isNull(schema.budgetItems.companyId))
      .orderBy(schema.budgetItems.displayOrder);
  }

  async getBudgetItem(id: string): Promise<BudgetItem | undefined> {
    const [item] = await db.select().from(schema.budgetItems).where(eq(schema.budgetItems.id, id));
    return item;
  }

  async createBudgetItem(insertItem: InsertBudgetItem): Promise<BudgetItem> {
    const [item] = await db.insert(schema.budgetItems).values(insertItem).returning();
    return item;
  }

  async updateBudgetItem(id: string, updateData: Partial<InsertBudgetItem>): Promise<BudgetItem | undefined> {
    const [item] = await db.update(schema.budgetItems).set(updateData).where(eq(schema.budgetItems.id, id)).returning();
    return item;
  }

  async deleteBudgetItem(id: string): Promise<void> {
    await db.delete(schema.budgetItems).where(eq(schema.budgetItems.id, id));
  }

  // Company-scoped price book methods
  async getCompanyPriceBookCategories(companyId: string): Promise<BudgetCategory[]> {
    return await db.select().from(schema.budgetCategories)
      .where(eq(schema.budgetCategories.companyId, companyId))
      .orderBy(schema.budgetCategories.displayOrder);
  }

  async getCompanyPriceBookItems(companyId: string): Promise<BudgetItem[]> {
    return await db.select().from(schema.budgetItems)
      .where(eq(schema.budgetItems.companyId, companyId))
      .orderBy(schema.budgetItems.displayOrder);
  }

  async getCompanyPriceBookItemsByCategory(categoryId: string, companyId: string): Promise<BudgetItem[]> {
    return await db.select().from(schema.budgetItems)
      .where(and(eq(schema.budgetItems.categoryId, categoryId), eq(schema.budgetItems.companyId, companyId)))
      .orderBy(schema.budgetItems.displayOrder);
  }

  // Project invite methods
  async createProjectInvite(insertInvite: InsertProjectInvite): Promise<ProjectInvite> {
    const [invite] = await db.insert(schema.projectInvites).values(insertInvite).returning();
    return invite;
  }

  async getProjectInviteByToken(token: string): Promise<ProjectInvite | undefined> {
    const [invite] = await db.select().from(schema.projectInvites).where(eq(schema.projectInvites.token, token));
    return invite;
  }

  async getProjectInvitesByProjectId(projectId: string): Promise<ProjectInvite[]> {
    return await db.select().from(schema.projectInvites).where(eq(schema.projectInvites.projectId, projectId));
  }

  async updateProjectInvite(id: string, updateData: Partial<InsertProjectInvite>): Promise<ProjectInvite | undefined> {
    const [invite] = await db.update(schema.projectInvites).set(updateData).where(eq(schema.projectInvites.id, id)).returning();
    return invite;
  }

  async acceptProjectInvite(token: string, userId: string): Promise<ProjectInvite | undefined> {
    const [invite] = await db.update(schema.projectInvites)
      .set({ status: "accepted", invitedUserId: userId })
      .where(eq(schema.projectInvites.token, token))
      .returning();
    return invite;
  }

  // Contractor request methods
  async createContractorRequest(insertRequest: InsertContractorRequest): Promise<ContractorRequest> {
    const [request] = await db.insert(schema.contractorRequests).values(insertRequest).returning();
    return request;
  }

  async getContractorRequests(): Promise<ContractorRequest[]> {
    return await db.select().from(schema.contractorRequests).orderBy(schema.contractorRequests.createdAt);
  }

  async getPendingContractorRequests(): Promise<ContractorRequest[]> {
    return await db.select().from(schema.contractorRequests).where(eq(schema.contractorRequests.status, "pending")).orderBy(schema.contractorRequests.createdAt);
  }

  async getContractorRequest(id: string): Promise<ContractorRequest | undefined> {
    const [request] = await db.select().from(schema.contractorRequests).where(eq(schema.contractorRequests.id, id));
    return request;
  }

  async updateContractorRequest(id: string, updateData: Partial<ContractorRequest>): Promise<ContractorRequest | undefined> {
    const [request] = await db.update(schema.contractorRequests).set(updateData).where(eq(schema.contractorRequests.id, id)).returning();
    return request;
  }

  // Migration method to convert existing project IDs to slug format
  async migrateProjectIdsToSlug(): Promise<{ migrated: number; errors: string[] }> {
    const errors: string[] = [];
    let migrated = 0;

    // Get all projects
    const allProjects = await db.select().from(schema.projects);
    
    for (const project of allProjects) {
      const oldId = project.id;
      
      // Skip if already looks like a slug (no dashes typical of UUIDs, contains numbers at end for date)
      if (!oldId.includes('-') || oldId.match(/\d{6,8}$/)) {
        continue;
      }

      try {
        // Generate new slug ID
        const createdDate = project.createdAt || new Date();
        const newId = generateProjectSlug(project.name, new Date(createdDate));
        
        // Check for collision and add suffix if needed
        const existingWithSlug = await db.select({ id: schema.projects.id })
          .from(schema.projects)
          .where(like(schema.projects.id, `${newId}%`));
        
        let finalNewId = newId;
        const filteredExisting = existingWithSlug.filter(p => p.id !== oldId);
        if (filteredExisting.length > 0) {
          let maxSuffix = 1;
          for (const proj of filteredExisting) {
            if (proj.id === newId) {
              maxSuffix = Math.max(maxSuffix, 1);
            } else {
              const match = proj.id.match(new RegExp(`^${newId}-(\\d+)$`));
              if (match) {
                maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10));
              }
            }
          }
          finalNewId = `${newId}-${maxSuffix + 1}`;
        }

        // Use a transaction with FK constraints temporarily dropped
        await db.transaction(async (tx) => {
          // Drop FK constraints
          await tx.execute(sql`ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE recurring_billing DROP CONSTRAINT IF EXISTS recurring_billing_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE project_phases DROP CONSTRAINT IF EXISTS project_phases_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE action_items DROP CONSTRAINT IF EXISTS action_items_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE inspiration_images DROP CONSTRAINT IF EXISTS inspiration_images_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE progress_posts DROP CONSTRAINT IF EXISTS progress_posts_project_id_projects_id_fk`);
          await tx.execute(sql`ALTER TABLE project_invites DROP CONSTRAINT IF EXISTS project_invites_project_id_projects_id_fk`);
          
          // Update project ID
          await tx.execute(sql`UPDATE projects SET id = ${finalNewId} WHERE id = ${oldId}`);
          
          // Update FK references
          await tx.execute(sql`UPDATE estimates SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE invoices SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE recurring_billing SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE project_phases SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE action_items SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE inspiration_images SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE messages SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE progress_posts SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          await tx.execute(sql`UPDATE project_invites SET project_id = ${finalNewId} WHERE project_id = ${oldId}`);
          
          // Re-add FK constraints
          await tx.execute(sql`ALTER TABLE estimates ADD CONSTRAINT estimates_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE invoices ADD CONSTRAINT invoices_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE recurring_billing ADD CONSTRAINT recurring_billing_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE project_phases ADD CONSTRAINT project_phases_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE action_items ADD CONSTRAINT action_items_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE inspiration_images ADD CONSTRAINT inspiration_images_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE messages ADD CONSTRAINT messages_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE progress_posts ADD CONSTRAINT progress_posts_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
          await tx.execute(sql`ALTER TABLE project_invites ADD CONSTRAINT project_invites_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES projects(id)`);
        });

        migrated++;
      } catch (err) {
        errors.push(`Failed to migrate project ${oldId}: ${err}`);
      }
    }

    return { migrated, errors };
  }

  // Project team member methods
  async getProjectTeamMembers(projectId: string): Promise<(ProjectTeamMember & { contractor?: User })[]> {
    const members = await db.select().from(schema.projectTeamMembers)
      .where(eq(schema.projectTeamMembers.projectId, projectId));
    
    // Get contractor details for each member
    const results: (ProjectTeamMember & { contractor?: User })[] = [];
    for (const member of members) {
      const contractor = await this.getUser(member.contractorId);
      results.push({ ...member, contractor });
    }
    return results;
  }

  async addProjectTeamMember(member: InsertProjectTeamMember): Promise<ProjectTeamMember> {
    const [teamMember] = await db.insert(schema.projectTeamMembers).values(member).returning();
    return teamMember;
  }

  async removeProjectTeamMember(id: string): Promise<void> {
    await db.delete(schema.projectTeamMembers).where(eq(schema.projectTeamMembers.id, id));
  }

  async getContractorProjects(contractorId: string): Promise<Project[]> {
    // Get projects where this contractor is a team member
    const teamMemberships = await db.select().from(schema.projectTeamMembers)
      .where(eq(schema.projectTeamMembers.contractorId, contractorId));
    
    const projectIds = teamMemberships.map(m => m.projectId);
    if (projectIds.length === 0) return [];
    
    const projects: Project[] = [];
    for (const projectId of projectIds) {
      const project = await this.getProject(projectId);
      if (project) projects.push(project);
    }
    return projects;
  }

  async getContractorProjectsWithDetails(contractorId: string): Promise<(Project & { companyName?: string; companyId?: string; companyLogo?: string | null; permissions?: ExternalMemberPermissions | null; membershipId: string })[]> {
    const teamMemberships = await db.select().from(schema.projectTeamMembers)
      .where(eq(schema.projectTeamMembers.contractorId, contractorId));

    if (teamMemberships.length === 0) return [];

    const results: (Project & { companyName?: string; companyId?: string; companyLogo?: string | null; permissions?: ExternalMemberPermissions | null; membershipId: string })[] = [];
    for (const membership of teamMemberships) {
      const project = await this.getProject(membership.projectId);
      if (!project) continue;
      let companyName: string | undefined;
      let companyId: string | undefined;
      let companyLogo: string | null = null;
      // Projects don't have a direct companyId; derive via the project's contractorId → user.companyId
      if (project.contractorId) {
        const contractor = await this.getUser(project.contractorId);
        if (contractor?.companyId) {
          const company = await this.getCompany(contractor.companyId);
          companyName = company?.name;
          companyId = company?.id;
          companyLogo = company?.logo ?? null;
        }
      }
      results.push({ ...project, companyName, companyId, companyLogo, permissions: membership.permissions as ExternalMemberPermissions | null, membershipId: membership.id });
    }
    return results;
  }

  async getProjectTeamMemberByContractorAndProject(projectId: string, contractorId: string): Promise<ProjectTeamMember | undefined> {
    const [member] = await db.select().from(schema.projectTeamMembers)
      .where(and(
        eq(schema.projectTeamMembers.projectId, projectId),
        eq(schema.projectTeamMembers.contractorId, contractorId)
      ));
    return member;
  }

  async updateProjectTeamMemberPermissions(memberId: string, permissions: object): Promise<ProjectTeamMember | undefined> {
    const [updated] = await db.update(schema.projectTeamMembers)
      .set({ permissions })
      .where(eq(schema.projectTeamMembers.id, memberId))
      .returning();
    return updated;
  }

  // Contractor invite methods
  async createContractorInvite(invite: InsertContractorInvite): Promise<ContractorInvite> {
    const [contractorInvite] = await db.insert(schema.contractorInvites).values(invite).returning();
    return contractorInvite;
  }

  async getContractorInviteByToken(token: string): Promise<ContractorInvite | undefined> {
    const [invite] = await db.select().from(schema.contractorInvites)
      .where(eq(schema.contractorInvites.token, token));
    return invite;
  }

  async getContractorInvitesByProject(projectId: string): Promise<ContractorInvite[]> {
    return await db.select().from(schema.contractorInvites)
      .where(eq(schema.contractorInvites.projectId, projectId));
  }

  async getPendingContractorInvites(): Promise<ContractorInvite[]> {
    return await db.select().from(schema.contractorInvites)
      .where(eq(schema.contractorInvites.status, 'pending'));
  }

  async getPendingContractorInvitesByEmail(email: string): Promise<ContractorInvite[]> {
    return await db.select().from(schema.contractorInvites)
      .where(
        and(
          eq(schema.contractorInvites.email, email),
          eq(schema.contractorInvites.status, 'pending')
        )
      );
  }

  async updateContractorInvite(id: string, data: Partial<InsertContractorInvite>): Promise<ContractorInvite | undefined> {
    const [invite] = await db.update(schema.contractorInvites)
      .set(data)
      .where(eq(schema.contractorInvites.id, id))
      .returning();
    return invite;
  }

  async acceptContractorInvite(token: string, userId: string): Promise<ContractorInvite | undefined> {
    const invite = await this.getContractorInviteByToken(token);
    if (!invite || invite.status !== 'pending') return undefined;
    
    // Mark invite as accepted
    const [updated] = await db.update(schema.contractorInvites)
      .set({ status: 'accepted', acceptedUserId: userId })
      .where(eq(schema.contractorInvites.id, invite.id))
      .returning();
    
    // If invite was for a specific project, add the contractor to the project team
    if (invite.projectId) {
      // Check if already a team member (avoid duplicate)
      const existingMembership = await this.getProjectTeamMemberByContractorAndProject(invite.projectId, userId);
      if (!existingMembership) {
        await this.addProjectTeamMember({
          projectId: invite.projectId,
          contractorId: userId,
          role: invite.contractorType || invite.companyType || null,
          addedBy: invite.invitedBy,
          permissions: (invite.permissions as ExternalMemberPermissions | null) ?? undefined,
        });
      }
    }
    
    return updated;
  }

  // Chat methods
  async getProjectChats(projectId: string, userId: string, isAdminOrPM: boolean): Promise<(Chat & { participants: (ChatParticipant & { user?: User })[], unreadCount: number })[]> {
    // Get all chats for the project
    const allChats = await db.select().from(schema.chats)
      .where(eq(schema.chats.projectId, projectId));
    
    const results: (Chat & { participants: (ChatParticipant & { user?: User })[], unreadCount: number })[] = [];
    
    for (const chat of allChats) {
      const participants = await this.getChatParticipants(chat.id);
      const isParticipant = participants.some(p => p.userId === userId);
      
      // Admin/PM can see all chats, others can only see chats they're part of
      if (isAdminOrPM || isParticipant) {
        const unreadCount = isParticipant ? await this.getUnreadMessageCount(chat.id, userId) : 0;
        results.push({
          ...chat,
          participants,
          unreadCount
        });
      }
    }
    
    // Sort by lastMessageAt descending (most recent first)
    results.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return results;
  }

  async getChat(chatId: string): Promise<Chat | undefined> {
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId));
    return chat;
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const [newChat] = await db.insert(schema.chats).values(chat).returning();
    return newChat;
  }

  async updateChat(chatId: string, data: Partial<InsertChat>): Promise<Chat | undefined> {
    const [updated] = await db.update(schema.chats)
      .set(data)
      .where(eq(schema.chats.id, chatId))
      .returning();
    return updated;
  }

  // Chat participant methods
  async getChatParticipants(chatId: string): Promise<(ChatParticipant & { user?: User })[]> {
    const participants = await db.select().from(schema.chatParticipants)
      .where(eq(schema.chatParticipants.chatId, chatId));
    
    const results: (ChatParticipant & { user?: User })[] = [];
    for (const participant of participants) {
      const user = await this.getUser(participant.userId);
      results.push({ ...participant, user });
    }
    return results;
  }

  async addChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant> {
    const [newParticipant] = await db.insert(schema.chatParticipants).values(participant).returning();
    return newParticipant;
  }

  async removeChatParticipant(chatId: string, userId: string): Promise<void> {
    await db.delete(schema.chatParticipants)
      .where(and(
        eq(schema.chatParticipants.chatId, chatId),
        eq(schema.chatParticipants.userId, userId)
      ));
  }

  async updateChatParticipantReadTime(chatId: string, userId: string): Promise<void> {
    await db.update(schema.chatParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(
        eq(schema.chatParticipants.chatId, chatId),
        eq(schema.chatParticipants.userId, userId)
      ));
  }

  async isUserInChat(chatId: string, userId: string): Promise<boolean> {
    const [participant] = await db.select().from(schema.chatParticipants)
      .where(and(
        eq(schema.chatParticipants.chatId, chatId),
        eq(schema.chatParticipants.userId, userId)
      ));
    return !!participant;
  }

  // Chat message methods
  async getChatMessages(chatId: string, limit: number = 50, before?: Date): Promise<ChatMessage[]> {
    let query = db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chatId));
    
    const messages = await query;
    
    // Filter by date if needed and sort
    let filtered = before 
      ? messages.filter(m => new Date(m.createdAt) < before)
      : messages;
    
    // Sort by createdAt ascending (oldest first for display)
    filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Return last N messages
    return filtered.slice(-limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(schema.chatMessages).values(message).returning();
    
    // Update the chat's last message info
    await this.updateChat(message.chatId, {
      lastMessageAt: new Date(),
      lastMessagePreview: message.content.substring(0, 100),
      lastMessageSenderId: message.senderId,
      lastMessageSenderName: message.senderName
    });
    
    return newMessage;
  }

  async getUnreadMessageCount(chatId: string, userId: string): Promise<number> {
    // Get user's last read time for this chat
    const [participant] = await db.select().from(schema.chatParticipants)
      .where(and(
        eq(schema.chatParticipants.chatId, chatId),
        eq(schema.chatParticipants.userId, userId)
      ));
    
    if (!participant) return 0;
    
    // Count messages after last read time that weren't sent by this user
    const messages = await db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chatId));
    
    const lastReadAt = participant.lastReadAt ? new Date(participant.lastReadAt) : new Date(0);
    
    return messages.filter(m => 
      new Date(m.createdAt) > lastReadAt && m.senderId !== userId
    ).length;
  }

  // Message read methods
  async getMessageReads(messageId: string): Promise<(MessageRead & { user?: User })[]> {
    const reads = await db.select().from(schema.messageReads)
      .where(eq(schema.messageReads.messageId, messageId));
    
    const results: (MessageRead & { user?: User })[] = [];
    for (const read of reads) {
      const user = await this.getUser(read.userId);
      results.push({ ...read, user });
    }
    return results;
  }

  async getChatMessageReads(chatId: string): Promise<(MessageRead & { user?: User })[]> {
    // Get all messages in this chat
    const messages = await db.select().from(schema.chatMessages)
      .where(eq(schema.chatMessages.chatId, chatId));
    
    const messageIds = messages.map(m => m.id);
    if (messageIds.length === 0) return [];
    
    // Get all reads for these messages
    const allReads: (MessageRead & { user?: User })[] = [];
    for (const messageId of messageIds) {
      const reads = await this.getMessageReads(messageId);
      allReads.push(...reads);
    }
    return allReads;
  }

  async createMessageRead(read: InsertMessageRead): Promise<MessageRead> {
    // Check if read already exists
    const existing = await db.select().from(schema.messageReads)
      .where(and(
        eq(schema.messageReads.messageId, read.messageId),
        eq(schema.messageReads.userId, read.userId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [newRead] = await db.insert(schema.messageReads).values(read).returning();
    return newRead;
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    // Update participant's lastReadAt
    await this.updateChatParticipantReadTime(chatId, userId);
    
    // Get all messages in this chat not by this user
    const messages = await db.select().from(schema.chatMessages)
      .where(and(
        eq(schema.chatMessages.chatId, chatId),
        not(eq(schema.chatMessages.senderId, userId))
      ));
    
    // Create read receipts for all unread messages
    for (const message of messages) {
      await this.createMessageRead({
        messageId: message.id,
        userId
      });
    }
  }

  // Default chat creation
  async createDefaultChatsForProject(
    projectId: string, 
    clientId: string | null, 
    teamMembers: { contractorId: string; role: string | null; name: string; companyName: string | null }[]
  ): Promise<void> {
    if (!clientId) return;
    
    const client = await this.getUser(clientId);
    if (!client) return;

    // Get project for context
    const project = await this.getProject(projectId);
    if (!project) return;
    
    // Create one-on-one chats between client and each team member
    for (const member of teamMembers) {
      const contractor = await this.getUser(member.contractorId);
      if (!contractor) continue;
      
      // Create direct chat
      const chat = await this.createChat({
        projectId,
        type: 'direct',
        title: null,
        createdById: member.contractorId,
        isDefault: true,
        lastMessageAt: new Date(),
        lastMessagePreview: `Hi! I'm ${member.name}${member.companyName ? ` with ${member.companyName}` : ''}. I'll be your ${member.role || 'contractor'} on this project. I'm looking forward to working with you!`,
        lastMessageSenderId: member.contractorId,
        lastMessageSenderName: member.name
      });
      
      // Add participants
      await this.addChatParticipant({ chatId: chat.id, userId: clientId });
      await this.addChatParticipant({ chatId: chat.id, userId: member.contractorId });
      
      // Create welcome message
      await this.createChatMessage({
        chatId: chat.id,
        projectId,
        senderId: member.contractorId,
        senderName: member.name,
        senderAvatar: contractor.profilePicture,
        content: `Hi! I'm ${member.name}${member.companyName ? ` with ${member.companyName}` : ''}. I'll be your ${member.role || 'contractor'} on this project. I'm looking forward to working with you!`
      });
    }
    
    // Create team group chat if there are team members
    if (teamMembers.length > 0) {
      const chat = await this.createChat({
        projectId,
        type: 'group',
        title: 'Team Chat',
        createdById: null,
        isDefault: true,
        lastMessageAt: new Date(),
        lastMessagePreview: `Welcome to the team chat for ${project.name}! This is where everyone involved in the project can communicate together.`,
        lastMessageSenderId: null,
        lastMessageSenderName: 'BuildVision'
      });
      
      // Add all participants
      await this.addChatParticipant({ chatId: chat.id, userId: clientId });
      for (const member of teamMembers) {
        await this.addChatParticipant({ chatId: chat.id, userId: member.contractorId });
      }
      
      // Create welcome message (system message)
      await this.createChatMessage({
        chatId: chat.id,
        projectId,
        senderId: clientId, // Use client as sender for now
        senderName: 'BuildVision',
        senderAvatar: null,
        content: `Welcome to the team chat for ${project.name}! This is where everyone involved in the project can communicate together.`
      });
    }
  }

  // Signing packet methods
  async getSigningPackets(projectId: string): Promise<SigningPacket[]> {
    return await db.select().from(schema.signingPackets)
      .where(eq(schema.signingPackets.projectId, projectId));
  }

  async getSigningPacket(id: string): Promise<SigningPacket | undefined> {
    const [packet] = await db.select().from(schema.signingPackets)
      .where(eq(schema.signingPackets.id, id));
    return packet;
  }

  async createSigningPacket(packet: InsertSigningPacket): Promise<SigningPacket> {
    const [created] = await db.insert(schema.signingPackets).values(packet).returning();
    return created;
  }

  async updateSigningPacket(id: string, data: Partial<InsertSigningPacket>): Promise<SigningPacket | undefined> {
    const [updated] = await db.update(schema.signingPackets)
      .set(data)
      .where(eq(schema.signingPackets.id, id))
      .returning();
    return updated;
  }

  // Signing participant methods
  async getSigningParticipants(packetId: string): Promise<SigningParticipant[]> {
    return await db.select().from(schema.signingParticipants)
      .where(eq(schema.signingParticipants.packetId, packetId));
  }

  async getSigningParticipantByToken(token: string): Promise<SigningParticipant | undefined> {
    // Hash the incoming token and look up by the hash
    const tokenHash = hashToken(token);
    const [participant] = await db.select().from(schema.signingParticipants)
      .where(eq(schema.signingParticipants.accessToken, tokenHash));
    return participant;
  }

  async createSigningParticipant(participant: InsertSigningParticipant): Promise<SigningParticipant> {
    const [created] = await db.insert(schema.signingParticipants).values(participant).returning();
    return created;
  }

  async updateSigningParticipant(id: string, data: Partial<SigningParticipant>): Promise<SigningParticipant | undefined> {
    const [updated] = await db.update(schema.signingParticipants)
      .set(data)
      .where(eq(schema.signingParticipants.id, id))
      .returning();
    return updated;
  }

  // Signing event methods
  async getSigningEvents(packetId: string): Promise<SigningEvent[]> {
    return await db.select().from(schema.signingEvents)
      .where(eq(schema.signingEvents.packetId, packetId));
  }

  async createSigningEvent(event: InsertSigningEvent): Promise<SigningEvent> {
    const [created] = await db.insert(schema.signingEvents).values(event).returning();
    return created;
  }

  // Signing field methods
  async getSigningFields(packetId: string): Promise<SigningField[]> {
    return await db.select().from(schema.signingFields)
      .where(eq(schema.signingFields.packetId, packetId));
  }

  async createSigningField(field: InsertSigningField): Promise<SigningField> {
    const [created] = await db.insert(schema.signingFields).values(field).returning();
    return created;
  }

  async updateSigningField(id: string, data: Partial<SigningField>): Promise<SigningField | undefined> {
    const [updated] = await db.update(schema.signingFields)
      .set(data)
      .where(eq(schema.signingFields.id, id))
      .returning();
    return updated;
  }

  async deleteSigningField(id: string): Promise<void> {
    await db.delete(schema.signingFields)
      .where(eq(schema.signingFields.id, id));
  }

  async deleteSigningFieldsByPacketId(packetId: string): Promise<void> {
    await db.delete(schema.signingFields)
      .where(eq(schema.signingFields.packetId, packetId));
  }

  // Client material item methods
  async getClientMaterialItems(projectId: string): Promise<ClientMaterialItem[]> {
    return await db.select().from(schema.clientMaterialItems)
      .where(eq(schema.clientMaterialItems.projectId, projectId))
      .orderBy(schema.clientMaterialItems.createdAt);
  }

  async getClientMaterialItem(id: string): Promise<ClientMaterialItem | undefined> {
    const [item] = await db.select().from(schema.clientMaterialItems)
      .where(eq(schema.clientMaterialItems.id, id));
    return item;
  }

  async createClientMaterialItem(item: InsertClientMaterialItem): Promise<ClientMaterialItem> {
    const [created] = await db.insert(schema.clientMaterialItems).values(item).returning();
    return created;
  }

  async updateClientMaterialItem(id: string, data: Partial<InsertClientMaterialItem>): Promise<ClientMaterialItem | undefined> {
    const [updated] = await db.update(schema.clientMaterialItems)
      .set(data)
      .where(eq(schema.clientMaterialItems.id, id))
      .returning();
    return updated;
  }

  async deleteClientMaterialItem(id: string): Promise<void> {
    await db.delete(schema.clientMaterialItems)
      .where(eq(schema.clientMaterialItems.id, id));
  }

  async hasClientMaterialItems(projectId: string): Promise<boolean> {
    const items = await db.select({ id: schema.clientMaterialItems.id })
      .from(schema.clientMaterialItems)
      .where(eq(schema.clientMaterialItems.projectId, projectId))
      .limit(1);
    return items.length > 0;
  }

  // Change order methods
  async getChangeOrders(projectId: string): Promise<ChangeOrder[]> {
    return await db.select().from(schema.changeOrders)
      .where(eq(schema.changeOrders.projectId, projectId))
      .orderBy(schema.changeOrders.orderNumber);
  }

  async getChangeOrder(id: string): Promise<ChangeOrder | undefined> {
    const [order] = await db.select().from(schema.changeOrders)
      .where(eq(schema.changeOrders.id, id));
    return order;
  }

  async createChangeOrder(order: InsertChangeOrder): Promise<ChangeOrder> {
    const [created] = await db.insert(schema.changeOrders).values(order).returning();
    return created;
  }

  async updateChangeOrder(id: string, data: Partial<InsertChangeOrder>): Promise<ChangeOrder | undefined> {
    const [updated] = await db.update(schema.changeOrders)
      .set(data)
      .where(eq(schema.changeOrders.id, id))
      .returning();
    return updated;
  }

  async deleteChangeOrder(id: string): Promise<void> {
    await db.delete(schema.changeOrderLineItems)
      .where(eq(schema.changeOrderLineItems.changeOrderId, id));
    await db.delete(schema.changeOrders)
      .where(eq(schema.changeOrders.id, id));
  }

  async getNextChangeOrderNumber(projectId: string): Promise<number> {
    const orders = await db.select({ orderNumber: schema.changeOrders.orderNumber })
      .from(schema.changeOrders)
      .where(eq(schema.changeOrders.projectId, projectId))
      .orderBy(schema.changeOrders.orderNumber);
    if (orders.length === 0) return 1;
    return Math.max(...orders.map(o => o.orderNumber)) + 1;
  }

  async getChangeOrderLineItems(changeOrderId: string): Promise<ChangeOrderLineItem[]> {
    return await db.select().from(schema.changeOrderLineItems)
      .where(eq(schema.changeOrderLineItems.changeOrderId, changeOrderId));
  }

  async createChangeOrderLineItem(item: InsertChangeOrderLineItem): Promise<ChangeOrderLineItem> {
    const [created] = await db.insert(schema.changeOrderLineItems).values(item).returning();
    return created;
  }

  async deleteChangeOrderLineItems(changeOrderId: string): Promise<void> {
    await db.delete(schema.changeOrderLineItems)
      .where(eq(schema.changeOrderLineItems.changeOrderId, changeOrderId));
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, id));
    return company;
  }

  async getCompanyByOwnerId(ownerId: string): Promise<Company | undefined> {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.ownerId, ownerId));
    return company;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(schema.companies).orderBy(schema.companies.createdAt);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db.insert(schema.companies).values(company).returning();
    return created;
  }

  async createCompanyWithOwner(companyData: InsertCompany, ownerData: InsertUser): Promise<{ company: Company; user: User }> {
    return await db.transaction(async (tx) => {
      const [company] = await tx.insert(schema.companies).values(companyData).returning();
      const [user] = await tx.insert(schema.users).values({ ...ownerData, companyId: company.id }).returning();
      const [updatedCompany] = await tx.update(schema.companies)
        .set({ ownerId: user.id })
        .where(eq(schema.companies.id, company.id))
        .returning();
      return { company: updatedCompany, user };
    });
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db.update(schema.companies).set(data).where(eq(schema.companies.id, id)).returning();
    return updated;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(schema.companies).where(eq(schema.companies.id, id));
  }

  // Company member methods
  async getCompanyMembers(companyId: string): Promise<(CompanyMember & { user?: User })[]> {
    const members = await db.select().from(schema.companyMembers)
      .where(eq(schema.companyMembers.companyId, companyId));
    const result: (CompanyMember & { user?: User })[] = [];
    for (const member of members) {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, member.userId));
      result.push({ ...member, user });
    }
    return result;
  }

  async getCompanyMember(companyId: string, userId: string): Promise<CompanyMember | undefined> {
    const [member] = await db.select().from(schema.companyMembers)
      .where(and(eq(schema.companyMembers.companyId, companyId), eq(schema.companyMembers.userId, userId)));
    return member;
  }

  async addCompanyMember(member: InsertCompanyMember): Promise<CompanyMember> {
    const [created] = await db.insert(schema.companyMembers).values(member).returning();
    return created;
  }

  async updateCompanyMember(companyId: string, userId: string, data: Partial<InsertCompanyMember>): Promise<CompanyMember | undefined> {
    const [updated] = await db.update(schema.companyMembers)
      .set(data)
      .where(and(eq(schema.companyMembers.companyId, companyId), eq(schema.companyMembers.userId, userId)))
      .returning();
    return updated;
  }

  async removeCompanyMember(companyId: string, userId: string): Promise<void> {
    await db.delete(schema.companyMembers)
      .where(and(eq(schema.companyMembers.companyId, companyId), eq(schema.companyMembers.userId, userId)));
  }

  async getUserCompanies(userId: string): Promise<(CompanyMember & { company?: Company })[]> {
    const memberships = await db.select().from(schema.companyMembers)
      .where(eq(schema.companyMembers.userId, userId));
    const result: (CompanyMember & { company?: Company })[] = [];
    for (const m of memberships) {
      const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, m.companyId));
      result.push({ ...m, company });
    }
    return result;
  }

  // Contractor role definition methods
  async getContractorRoleDefinitions(): Promise<ContractorRoleDefinition[]> {
    return await db.select().from(schema.contractorRoleDefinitions).orderBy(schema.contractorRoleDefinitions.type, schema.contractorRoleDefinitions.name);
  }

  async getContractorRoleDefinition(id: string): Promise<ContractorRoleDefinition | undefined> {
    const [def] = await db.select().from(schema.contractorRoleDefinitions).where(eq(schema.contractorRoleDefinitions.id, id));
    return def;
  }

  async createContractorRoleDefinition(def: InsertContractorRoleDefinition): Promise<ContractorRoleDefinition> {
    const [created] = await db.insert(schema.contractorRoleDefinitions).values(def).returning();
    return created;
  }

  async updateContractorRoleDefinition(id: string, data: Partial<InsertContractorRoleDefinition>): Promise<ContractorRoleDefinition | undefined> {
    const [updated] = await db.update(schema.contractorRoleDefinitions).set(data).where(eq(schema.contractorRoleDefinitions.id, id)).returning();
    return updated;
  }

  async deleteContractorRoleDefinition(id: string): Promise<void> {
    await db.delete(schema.contractorRoleDefinitions).where(eq(schema.contractorRoleDefinitions.id, id));
  }

  // Projects by company
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    // Get all company_owner users with this companyId, then get their projects
    const owners = await db.select().from(schema.users)
      .where(eq(schema.users.companyId, companyId));
    if (owners.length === 0) return [];
    const ownerIds = owners.map(o => o.id);
    const projects: Project[] = [];
    for (const ownerId of ownerIds) {
      const ownerProjects = await db.select().from(schema.projects)
        .where(eq(schema.projects.contractorId, ownerId));
      projects.push(...ownerProjects);
    }
    return projects;
  }

  // Subscription tier methods
  async getSubscriptionTiers(): Promise<SubscriptionTier[]> {
    return await db.select().from(schema.subscriptionTiers).orderBy(schema.subscriptionTiers.sortOrder, schema.subscriptionTiers.name);
  }

  async getActiveSubscriptionTiers(): Promise<SubscriptionTier[]> {
    return await db.select().from(schema.subscriptionTiers)
      .where(eq(schema.subscriptionTiers.isActive, true))
      .orderBy(schema.subscriptionTiers.sortOrder, schema.subscriptionTiers.name);
  }

  async getSubscriptionTier(id: string): Promise<SubscriptionTier | undefined> {
    const [tier] = await db.select().from(schema.subscriptionTiers).where(eq(schema.subscriptionTiers.id, id));
    return tier;
  }

  async createSubscriptionTier(tier: InsertSubscriptionTier): Promise<SubscriptionTier> {
    const [created] = await db.insert(schema.subscriptionTiers).values(tier).returning();
    return created;
  }

  async updateSubscriptionTier(id: string, data: Partial<InsertSubscriptionTier>): Promise<SubscriptionTier | undefined> {
    const [updated] = await db.update(schema.subscriptionTiers).set(data).where(eq(schema.subscriptionTiers.id, id)).returning();
    return updated;
  }

  async deleteSubscriptionTier(id: string): Promise<void> {
    await db.delete(schema.subscriptionTiers).where(eq(schema.subscriptionTiers.id, id));
  }

  // Demo request methods
  async createDemoRequest(data: InsertDemoRequest): Promise<DemoRequest> {
    const [created] = await db.insert(schema.demoRequests).values(data).returning();
    return created;
  }

  async getDemoRequests(): Promise<DemoRequest[]> {
    return await db.select().from(schema.demoRequests).orderBy(sql`${schema.demoRequests.createdAt} DESC`);
  }

  async getDemoRequest(id: string): Promise<DemoRequest | undefined> {
    const [req] = await db.select().from(schema.demoRequests).where(eq(schema.demoRequests.id, id));
    return req;
  }

  async updateDemoRequest(id: string, data: Partial<InsertDemoRequest>): Promise<DemoRequest | undefined> {
    const [updated] = await db.update(schema.demoRequests).set(data).where(eq(schema.demoRequests.id, id)).returning();
    return updated;
  }

  // Platform settings — singleton row with id=1; upsert on update
  async getPlatformSettings(): Promise<PlatformSettings> {
    const [row] = await db.select().from(schema.platformSettings).where(eq(schema.platformSettings.id, 1));
    if (row) return row;
    // Auto-create the default singleton row
    const [created] = await db.insert(schema.platformSettings)
      .values({ id: 1, defaultTrialDays: 7, manualBillingEnabled: true, freeAccessEnabled: false, prepaidAccessEnabled: false, defaultMonthlyPrice: "0" })
      .returning();
    return created;
  }

  async updatePlatformSettings(data: Partial<InsertPlatformSettings>): Promise<PlatformSettings> {
    // Ensure row exists first
    await this.getPlatformSettings();
    const [updated] = await db.update(schema.platformSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.platformSettings.id, 1))
      .returning();
    return updated;
  }

  // Global invite access (admin)
  async getAllContractorInvites(): Promise<ContractorInvite[]> {
    return await db.select().from(schema.contractorInvites).orderBy(sql`${schema.contractorInvites.createdAt} DESC`);
  }

  async getContractorInviteById(id: string): Promise<ContractorInvite | undefined> {
    const [inv] = await db.select().from(schema.contractorInvites).where(eq(schema.contractorInvites.id, id));
    return inv;
  }

  async getAllProjectInvites(): Promise<ProjectInvite[]> {
    return await db.select().from(schema.projectInvites).orderBy(sql`${schema.projectInvites.createdAt} DESC`);
  }

  async getProjectInviteById(id: string): Promise<ProjectInvite | undefined> {
    const [inv] = await db.select().from(schema.projectInvites).where(eq(schema.projectInvites.id, id));
    return inv;
  }
}

export const storage = new DatabaseStorage();
