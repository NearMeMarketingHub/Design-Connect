import { eq, and, not, isNull, like, sql } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import bcrypt from "bcryptjs";

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
  Project, InsertProject,
  Estimate, InsertEstimate,
  EstimateLineItem, InsertEstimateLineItem,
  Invoice, InsertInvoice,
  InvoiceLineItem, InsertInvoiceLineItem,
  RecurringBilling, InsertRecurringBilling,
  ProjectPhase, InsertProjectPhase,
  PhaseUpdate, InsertPhaseUpdate,
  ActionItem, InsertActionItem,
  InspirationImage, InsertInspirationImage,
  Message, InsertMessage,
  ProgressPost, InsertProgressPost,
  PostComment, InsertPostComment,
  PostReaction, InsertPostReaction,
  BudgetCategory, InsertBudgetCategory,
  BudgetItem, InsertBudgetItem,
  ProjectInvite, InsertProjectInvite,
  ContractorRequest, InsertContractorRequest
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsernameOrEmail(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  createProjectPhase(phase: InsertProjectPhase): Promise<ProjectPhase>;
  updateProjectPhase(id: string, phase: Partial<InsertProjectPhase>): Promise<ProjectPhase | undefined>;
  recalculateProjectProgress(projectId: string): Promise<void>;
  
  // Phase update methods
  getPhaseUpdates(phaseId: string): Promise<PhaseUpdate[]>;
  getProjectPhaseUpdates(projectId: string): Promise<PhaseUpdate[]>;
  createPhaseUpdate(update: InsertPhaseUpdate): Promise<PhaseUpdate>;
  deletePhaseUpdate(id: string): Promise<void>;
  
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
  getAllProjectsWithDetails(): Promise<(Project & { clientName?: string; contractorName?: string })[]>;
  getPendingContractors(): Promise<User[]>;
  approveContractor(id: string): Promise<User | undefined>;
  rejectContractor(id: string): Promise<void>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;

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
  
  // Migration methods
  migrateProjectIdsToSlug(): Promise<{ migrated: number; errors: string[] }>;
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
    return await db.select().from(schema.projectPhases).where(eq(schema.projectPhases.projectId, projectId));
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
      // Auto-recalculate project progress after updating a phase
      await this.recalculateProjectProgress(phase.projectId);
    }
    return phase;
  }

  // Calculate project progress based on completed phases/milestones
  async recalculateProjectProgress(projectId: string): Promise<void> {
    const phases = await this.getProjectPhases(projectId);
    if (phases.length === 0) return;
    
    // Handle various status formats: 'completed', 'Completed'
    const completedPhases = phases.filter(p => p.status.toLowerCase() === 'completed').length;
    const progress = Math.round((completedPhases / phases.length) * 100);
    
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

  async getAllProjectsWithDetails(): Promise<(Project & { clientName?: string; contractorName?: string })[]> {
    const projects = await db.select().from(schema.projects);
    const projectsWithDetails = await Promise.all(
      projects.map(async (project) => {
        let clientName: string | undefined;
        let contractorName: string | undefined;
        
        if (project.clientId) {
          const client = await this.getUser(project.clientId);
          clientName = client?.name || client?.username;
        }
        
        if (project.contractorId) {
          const contractor = await this.getUser(project.contractorId);
          contractorName = contractor?.name || contractor?.username;
        }
        
        return { ...project, clientName, contractorName };
      })
    );
    return projectsWithDetails;
  }

  async getPendingContractors(): Promise<User[]> {
    return await db.select().from(schema.users).where(
      and(
        eq(schema.users.role, "contractor"),
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
    return await db.select().from(schema.budgetCategories).orderBy(schema.budgetCategories.displayOrder);
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
    return await db.select().from(schema.budgetItems).orderBy(schema.budgetItems.displayOrder);
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
}

export const storage = new DatabaseStorage();
