import { eq, and, not, isNull } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User, InsertUser,
  Project, InsertProject,
  Estimate, InsertEstimate,
  EstimateLineItem, InsertEstimateLineItem,
  Invoice, InsertInvoice,
  InvoiceLineItem, InsertInvoiceLineItem,
  RecurringBilling, InsertRecurringBilling,
  ProjectPhase, InsertProjectPhase,
  ActionItem, InsertActionItem,
  InspirationImage, InsertInspirationImage,
  Message, InsertMessage
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
  
  // Action item methods
  getActionItems(projectId: string): Promise<ActionItem[]>;
  createActionItem(item: InsertActionItem): Promise<ActionItem>;
  updateActionItem(id: string, item: Partial<InsertActionItem>): Promise<ActionItem | undefined>;
  
  // Inspiration image methods
  getInspirationImages(projectId: string): Promise<InspirationImage[]>;
  createInspirationImage(image: InsertInspirationImage): Promise<InspirationImage>;
  
  // Message methods
  getMessages(projectId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, content: string): Promise<Message | undefined>;
  deleteMessage(id: string): Promise<Message | undefined>;
  markMessageAsRead(id: string): Promise<Message | undefined>;
  markProjectMessagesAsRead(projectId: string, userId: string): Promise<void>;
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
    const [project] = await db.insert(schema.projects).values(insertProject).returning();
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
    return phase;
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
}

export const storage = new DatabaseStorage();
