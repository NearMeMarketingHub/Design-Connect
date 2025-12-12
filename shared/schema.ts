import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("client"),
  name: text("name"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
});

export const insertProjectPhaseSchema = createInsertSchema(projectPhases).omit({ id: true });
export type InsertProjectPhase = z.infer<typeof insertProjectPhaseSchema>;
export type ProjectPhase = typeof projectPhases.$inferSelect;

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
  caption: text("caption"),
});

export const insertInspirationImageSchema = createInsertSchema(inspirationImages).omit({ id: true });
export type InsertInspirationImage = z.infer<typeof insertInspirationImageSchema>;
export type InspirationImage = typeof inspirationImages.$inferSelect;

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, timestamp: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
