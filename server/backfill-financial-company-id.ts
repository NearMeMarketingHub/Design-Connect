/**
 * Idempotent startup backfill: populate companyId on estimates, invoices, and
 * recurring_billing records that were created before Phase 11B.
 *
 * Strategy:
 *   record.projectId → projects.contractorId → users.companyId
 *
 * Rules:
 * - Skip records that already have companyId set (never overwrite).
 * - If any step in the chain is null / missing, leave the record null and log a warning.
 * - Never guess companyId.
 * - A single orphaned record must not abort the whole backfill or crash startup.
 */

import { eq, isNull } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

async function backfillEstimates(): Promise<{ backfilled: number; orphaned: number }> {
  const records = await db
    .select()
    .from(schema.estimates)
    .where(isNull(schema.estimates.companyId));

  let backfilled = 0;
  let orphaned = 0;

  for (const record of records) {
    try {
      if (!record.projectId) {
        console.warn(`[backfill] estimate ${record.id}: orphaned — no projectId`);
        orphaned++;
        continue;
      }
      const [project] = await db
        .select({ contractorId: schema.projects.contractorId })
        .from(schema.projects)
        .where(eq(schema.projects.id, record.projectId));
      if (!project?.contractorId) {
        console.warn(`[backfill] estimate ${record.id}: orphaned — project has no contractorId`);
        orphaned++;
        continue;
      }
      const [contractor] = await db
        .select({ companyId: schema.users.companyId })
        .from(schema.users)
        .where(eq(schema.users.id, project.contractorId));
      if (!contractor?.companyId) {
        console.warn(`[backfill] estimate ${record.id}: orphaned — contractor has no companyId`);
        orphaned++;
        continue;
      }
      await db
        .update(schema.estimates)
        .set({ companyId: contractor.companyId })
        .where(eq(schema.estimates.id, record.id));
      backfilled++;
    } catch (err) {
      console.warn(`[backfill] estimate ${record.id}: error —`, err);
      orphaned++;
    }
  }

  return { backfilled, orphaned };
}

async function backfillInvoices(): Promise<{ backfilled: number; orphaned: number }> {
  const records = await db
    .select()
    .from(schema.invoices)
    .where(isNull(schema.invoices.companyId));

  let backfilled = 0;
  let orphaned = 0;

  for (const record of records) {
    try {
      if (!record.projectId) {
        console.warn(`[backfill] invoice ${record.id}: orphaned — no projectId`);
        orphaned++;
        continue;
      }
      const [project] = await db
        .select({ contractorId: schema.projects.contractorId })
        .from(schema.projects)
        .where(eq(schema.projects.id, record.projectId));
      if (!project?.contractorId) {
        console.warn(`[backfill] invoice ${record.id}: orphaned — project has no contractorId`);
        orphaned++;
        continue;
      }
      const [contractor] = await db
        .select({ companyId: schema.users.companyId })
        .from(schema.users)
        .where(eq(schema.users.id, project.contractorId));
      if (!contractor?.companyId) {
        console.warn(`[backfill] invoice ${record.id}: orphaned — contractor has no companyId`);
        orphaned++;
        continue;
      }
      await db
        .update(schema.invoices)
        .set({ companyId: contractor.companyId })
        .where(eq(schema.invoices.id, record.id));
      backfilled++;
    } catch (err) {
      console.warn(`[backfill] invoice ${record.id}: error —`, err);
      orphaned++;
    }
  }

  return { backfilled, orphaned };
}

async function backfillRecurringBilling(): Promise<{ backfilled: number; orphaned: number }> {
  const records = await db
    .select()
    .from(schema.recurringBilling)
    .where(isNull(schema.recurringBilling.companyId));

  let backfilled = 0;
  let orphaned = 0;

  for (const record of records) {
    try {
      if (!record.projectId) {
        console.warn(`[backfill] recurring_billing ${record.id}: orphaned — no projectId`);
        orphaned++;
        continue;
      }
      const [project] = await db
        .select({ contractorId: schema.projects.contractorId })
        .from(schema.projects)
        .where(eq(schema.projects.id, record.projectId));
      if (!project?.contractorId) {
        console.warn(`[backfill] recurring_billing ${record.id}: orphaned — project has no contractorId`);
        orphaned++;
        continue;
      }
      const [contractor] = await db
        .select({ companyId: schema.users.companyId })
        .from(schema.users)
        .where(eq(schema.users.id, project.contractorId));
      if (!contractor?.companyId) {
        console.warn(`[backfill] recurring_billing ${record.id}: orphaned — contractor has no companyId`);
        orphaned++;
        continue;
      }
      await db
        .update(schema.recurringBilling)
        .set({ companyId: contractor.companyId })
        .where(eq(schema.recurringBilling.id, record.id));
      backfilled++;
    } catch (err) {
      console.warn(`[backfill] recurring_billing ${record.id}: error —`, err);
      orphaned++;
    }
  }

  return { backfilled, orphaned };
}

export async function backfillFinancialCompanyIds(): Promise<void> {
  console.log("[backfill] Starting financial records companyId backfill...");
  try {
    const est = await backfillEstimates();
    console.log(`[backfill] estimates: ${est.backfilled} backfilled, ${est.orphaned} orphaned`);

    const inv = await backfillInvoices();
    console.log(`[backfill] invoices: ${inv.backfilled} backfilled, ${inv.orphaned} orphaned`);

    const rec = await backfillRecurringBilling();
    console.log(`[backfill] recurring_billing: ${rec.backfilled} backfilled, ${rec.orphaned} orphaned`);

    const totalBackfilled = est.backfilled + inv.backfilled + rec.backfilled;
    const totalOrphaned = est.orphaned + inv.orphaned + rec.orphaned;
    if (totalBackfilled > 0 || totalOrphaned > 0) {
      console.log(`[backfill] Complete: ${totalBackfilled} records backfilled, ${totalOrphaned} orphaned`);
    }
  } catch (err) {
    // Never crash startup — log and continue
    console.error("[backfill] Financial companyId backfill failed unexpectedly:", err);
  }
}
