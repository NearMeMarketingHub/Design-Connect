/**
 * Idempotent role migration: promotes legacy contractor accounts to company_owner
 * and ensures notary/subcontractor contractor types are preserved.
 *
 * Run on server startup. Safe to run multiple times.
 */
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, isNull, or, sql } from "drizzle-orm";

export async function runRoleMigration(): Promise<void> {
  console.log("[migrate-roles] Starting role migration check...");

  // Find all users with role='contractor', no companyId, and no contractorType
  // (or contractorType = 'contractor' which means plain contractor).
  // These are legacy accounts that predate the company architecture and should be
  // upgraded to company_owner with an auto-created company.
  const legacyContractors = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.role, "contractor"),
        isNull(schema.users.companyId),
        or(isNull(schema.users.contractorType), eq(schema.users.contractorType, "contractor"))
      )
    );

  let migrated = 0;
  for (const user of legacyContractors) {
    // Create a company for this legacy contractor
    const companyName = user.companyName || `${user.name || user.username}'s Company`;
    const [company] = await db
      .insert(schema.companies)
      .values({
        name: companyName,
        ownerId: user.id,
        subscriptionPlan: "free",
        subscriptionStatus: "active",
      })
      .returning();

    // Promote the user to company_owner and link to new company
    await db
      .update(schema.users)
      .set({ role: "company_owner", companyId: company.id, isApproved: true })
      .where(eq(schema.users.id, user.id));

    console.log(`[migrate-roles] Promoted user ${user.username} → company_owner (company: ${company.name})`);
    migrated++;
  }

  // Ensure any legacy users with role='notary' (a discontinued role value) are migrated
  // to role='contractor' + contractorType='notary'. Uses raw SQL to avoid typing the
  // discontinued enum value into the TypeScript union.
  const notaryResult = await db.execute(
    sql`SELECT id, username FROM users WHERE role = 'notary'`
  );
  const legacyNotaries = (notaryResult.rows ?? notaryResult) as Array<{ id: string; username: string }>;
  for (const user of legacyNotaries) {
    await db.execute(
      sql`UPDATE users SET role = 'contractor', contractor_type = 'notary' WHERE id = ${user.id}`
    );
    console.log(`[migrate-roles] Migrated legacy notary ${user.username} → contractor+notary`);
    migrated++;
  }

  if (migrated === 0) {
    console.log("[migrate-roles] No legacy accounts to migrate. All users are up to date.");
  } else {
    console.log(`[migrate-roles] Migration complete. ${migrated} account(s) updated.`);
  }
}
