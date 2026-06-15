import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, companies } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { log } from "./index";

const DEMO_USERNAMES = [
  "demo_owner",
  "demo_contractor",
  "demo_notary",
  "demo_subcontractor",
  "demo_client",
];

// Test accounts that should be disabled on the live app
const TEST_USERNAMES_TO_DISABLE = [
  "testadmin",
  "testcontractor",
  "testclient",
  "testnotary",
  "testsubcontractor",
];

export async function seedDemoAccounts() {
  try {
    // Check which demo usernames already exist
    const existingRows = await db
      .select({ username: users.username })
      .from(users)
      .where(inArray(users.username, DEMO_USERNAMES));
    const existingSet = new Set(existingRows.map((r) => r.username));

    // Super admin test account
    const [existingSuperAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "superadmin"));

    const superAdminHash = await bcrypt.hash("Demo.123!", 12);
    if (!existingSuperAdmin) {
      await db.insert(users).values({
        username: "superadmin",
        email: "superadmin@buildvision.test",
        password: superAdminHash,
        role: "admin",
        name: "Super Admin",
        isApproved: true,
      });
      log("seedDemoAccounts: created superadmin", "seed");
    }

    // Cameron — update password if account exists, create if not
    const [cameron] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "cameron@nearmemarketinghub.com"));

    const cameronHash = await bcrypt.hash("Marketing.123!", 12);
    if (cameron) {
      await db
        .update(users)
        .set({ password: cameronHash })
        .where(eq(users.email, "cameron@nearmemarketinghub.com"));
      log("seedDemoAccounts: updated Cameron password", "seed");
    } else {
      await db.insert(users).values({
        username: "cameron_admin",
        email: "cameron@nearmemarketinghub.com",
        password: cameronHash,
        role: "admin",
        name: "Cameron",
        isApproved: true,
      });
      log("seedDemoAccounts: created cameron_admin", "seed");
    }

    // Disable test accounts on the live app (idempotent)
    await db
      .update(users)
      .set({ isDisabled: true })
      .where(inArray(users.username, TEST_USERNAMES_TO_DISABLE));
    log("seedDemoAccounts: disabled test accounts", "seed");

    if (existingSet.size === DEMO_USERNAMES.length) {
      // All demo accounts already present — nothing else to do
      return;
    }

    const demoHash = await bcrypt.hash("Demo.123!", 12);

    // Create the demo company only if demo_owner doesn't exist yet
    let demoCompanyId: string | null = null;
    if (!existingSet.has("demo_owner")) {
      const [company] = await db
        .insert(companies)
        .values({ name: "Demo Construction Co.", subscriptionStatus: "active", billingType: "manual" })
        .returning({ id: companies.id });
      demoCompanyId = company.id;
      log(`seedDemoAccounts: created demo company ${demoCompanyId}`, "seed");
    } else {
      const [ownerRow] = await db
        .select({ companyId: users.companyId })
        .from(users)
        .where(eq(users.username, "demo_owner"));
      demoCompanyId = ownerRow?.companyId ?? null;
    }

    const toCreate = [
      { username: "demo_owner",         email: "demo.owner@buildvision.test",         role: "company_owner", name: "Demo Owner",         companyId: demoCompanyId,  contractorType: null },
      { username: "demo_contractor",    email: "demo.contractor@buildvision.test",    role: "contractor",    name: "Demo Contractor",    companyId: demoCompanyId,  contractorType: "contractor" },
      { username: "demo_notary",        email: "demo.notary@buildvision.test",        role: "contractor",    name: "Demo Notary",        companyId: demoCompanyId,  contractorType: "notary" },
      { username: "demo_subcontractor", email: "demo.subcontractor@buildvision.test", role: "contractor",    name: "Demo Subcontractor", companyId: null,           contractorType: "subcontractor" },
      { username: "demo_client",        email: "demo.client@buildvision.test",        role: "client",        name: "Demo Client",        companyId: null,           contractorType: null },
    ];

    let ownerId: string | null = null;
    for (const acct of toCreate) {
      if (existingSet.has(acct.username)) continue;
      const [inserted] = await db
        .insert(users)
        .values({
          username: acct.username,
          email: acct.email,
          password: demoHash,
          role: acct.role,
          name: acct.name,
          companyId: acct.companyId ?? undefined,
          contractorType: acct.contractorType ?? undefined,
          isApproved: true,
        })
        .returning({ id: users.id });
      if (acct.username === "demo_owner") ownerId = inserted.id;
      log(`seedDemoAccounts: created ${acct.username}`, "seed");
    }

    // Link company → owner
    if (demoCompanyId && ownerId) {
      await db
        .update(companies)
        .set({ ownerId })
        .where(eq(companies.id, demoCompanyId));
      log("seedDemoAccounts: linked demo company owner", "seed");
    }
  } catch (err) {
    console.error("seedDemoAccounts error:", err);
  }
}
