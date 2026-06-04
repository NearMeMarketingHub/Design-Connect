/**
 * Idempotent test account seeding: ensures all named test accounts exist
 * with correct roles, passwords, and project assignments.
 *
 * Run on server startup. Safe to run multiple times.
 *
 * Test accounts (all use password: Test123!):
 *   testadmin          — Admin portal (/admin-login)
 *   testcontractor     — Company Owner portal (/auth → Company tab)
 *   testnotary         — Sub/Notary hub (/auth → Sub/Notary tab)
 *   testsubcontractor  — Sub/Notary hub (/auth → Sub/Notary tab)
 *   testclient         — Client portal (/auth → Client tab)
 *
 * See TESTACCOUNTS.md for full credentials reference.
 */
import bcrypt from "bcryptjs";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { DEFAULT_SUBCONTRACTOR_PERMISSIONS } from "@shared/schema";

const TEST_PASSWORD = "Test123!";

export async function seedTestAccounts(): Promise<void> {
  console.log("[seed-test-accounts] Checking test accounts...");

  // Ensure testsubcontractor exists (the only test account not created elsewhere)
  const [existingSub] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, "testsubcontractor"));

  let subId: string;

  if (!existingSub) {
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
    const [newSub] = await db
      .insert(schema.users)
      .values({
        username: "testsubcontractor",
        email: "testsubcontractor@buildvision.test",
        password: hashedPassword,
        role: "contractor",
        contractorType: "subcontractor",
        isApproved: true,
        isCompanyAdmin: false,
      })
      .returning();
    subId = newSub.id;
    console.log("[seed-test-accounts] Created testsubcontractor account.");
  } else {
    subId = existingSub.id;
    console.log("[seed-test-accounts] testsubcontractor already exists — skipping.");
  }

  // Assign testsubcontractor to The Jenkins Residence if not already a member
  const PROJECT_ID = "thejenkinsresidence012026";

  const [existingMembership] = await db
    .select()
    .from(schema.projectTeamMembers)
    .where(
      and(
        eq(schema.projectTeamMembers.projectId, PROJECT_ID),
        eq(schema.projectTeamMembers.contractorId, subId)
      )
    );

  if (!existingMembership) {
    // Find testcontractor to use as the addedBy reference
    const [addedByUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, "testcontractor"));

    await db.insert(schema.projectTeamMembers).values({
      projectId: PROJECT_ID,
      contractorId: subId,
      role: "subcontractor",
      addedBy: addedByUser?.id ?? null,
      permissions: DEFAULT_SUBCONTRACTOR_PERMISSIONS,
      isProjectLead: false,
    });
    console.log("[seed-test-accounts] Assigned testsubcontractor to The Jenkins Residence.");
  } else {
    console.log("[seed-test-accounts] testsubcontractor already assigned to Jenkins Residence — skipping.");
  }

  // Ensure testcontractor's company is not stuck on a legacy trialing status
  const [tcUser] = await db.select().from(schema.users).where(eq(schema.users.username, "testcontractor"));
  if (tcUser?.companyId) {
    const [company] = await db.select().from(schema.companies).where(eq(schema.companies.id, tcUser.companyId));
    if (company && company.subscriptionStatus === "trialing") {
      await db.update(schema.companies)
        .set({ subscriptionStatus: "free" })
        .where(eq(schema.companies.id, company.id));
      console.log("[seed-test-accounts] Migrated testcontractor company from trialing → free.");
    }
  }

  console.log("[seed-test-accounts] Done.");
}
