/**
 * SCOPE CONSTRAINT — this module must ONLY be imported by demo-request routes.
 *
 * HubSpot sync is intentionally scoped to demo requests submitted via the /demo
 * page. It must never be used to sync BuildVision users, companies, clients,
 * contractors, projects, invites, or any other platform entity.
 *
 * Allowed callers:
 *   - POST /api/contact          (server/routes.ts — new demo request)
 *   - POST /api/admin/demo-requests/:id/retry-hubspot  (server/routes.ts — admin retry)
 */
import { Client } from "@hubspot/api-client";
import { FilterOperatorEnum } from "@hubspot/api-client/lib/codegen/crm/contacts/models/Filter";
import { AssociationSpecAssociationCategoryEnum } from "@hubspot/api-client/lib/codegen/crm/associations/v4/models/AssociationSpec";
import type { DemoRequest } from "@shared/schema";

const MAX_ERROR_LENGTH = 500;

export function trimError(raw: string): string {
  if (raw.length <= MAX_ERROR_LENGTH) return raw;
  return raw.slice(0, MAX_ERROR_LENGTH - 1) + "…"; // always ≤ 500 chars
}

export interface HubspotSyncResult {
  status: "not_configured" | "synced" | "failed";
  contactId?: string;
  companyId?: string;
  dealId?: string;
  error?: string;
}

function getClient(): Client | null {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token || token.trim() === "") return null;
  return new Client({ accessToken: token.trim() });
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function upsertContact(client: Client, req: DemoRequest): Promise<string> {
  // hs_lead_source is intentionally omitted — it is a portal-enumerated property that may not
  // exist in every HubSpot account. Source tracking is preserved in the note body instead.
  const { firstName, lastName } = splitName(req.name);
  const properties: Record<string, string> = {
    email: req.email,
    firstname: firstName,
    lastname: lastName,
    phone: req.phone || "",
    company: req.company || "",
  };

  // If we already have a HubSpot contact ID, update it directly (idempotent retry)
  if (req.hubspotContactId) {
    await client.crm.contacts.basicApi.update(req.hubspotContactId, { properties });
    return req.hubspotContactId;
  }

  // Search for existing contact by email
  const searchRes = await client.crm.contacts.searchApi.doSearch({
    filterGroups: [{ filters: [{ propertyName: "email", operator: FilterOperatorEnum.Eq, value: req.email }] }],
    properties: ["email", "firstname", "lastname"],
    limit: 1,
    after: "0",
    sorts: [],
  });

  if (searchRes.results && searchRes.results.length > 0) {
    const existing = searchRes.results[0];
    await client.crm.contacts.basicApi.update(existing.id, { properties });
    return existing.id;
  }

  const created = await client.crm.contacts.basicApi.create({ properties });
  return created.id;
}

async function upsertCompany(client: Client, req: DemoRequest): Promise<string | null> {
  const companyName = req.company || "";
  if (!companyName.trim()) return null;

  // If we already have a HubSpot company ID, update it directly (idempotent retry)
  if (req.hubspotCompanyId) {
    await client.crm.companies.basicApi.update(req.hubspotCompanyId, {
      properties: { name: companyName },
    });
    return req.hubspotCompanyId;
  }

  // Search for existing company by name
  const searchRes = await client.crm.companies.searchApi.doSearch({
    filterGroups: [{ filters: [{ propertyName: "name", operator: FilterOperatorEnum.Eq, value: companyName }] }],
    properties: ["name"],
    limit: 1,
    after: "0",
    sorts: [],
  });

  if (searchRes.results && searchRes.results.length > 0) {
    return searchRes.results[0].id;
  }

  const created = await client.crm.companies.basicApi.create({
    properties: { name: companyName },
  });
  return created.id;
}

async function createDeal(client: Client, req: DemoRequest): Promise<string> {
  const created = await client.crm.deals.basicApi.create({
    properties: {
      dealname: `BuildVision Demo — ${req.name}`,
      pipeline: "default",
      dealstage: "appointmentscheduled",
      description: `Demo request submitted on ${new Date(req.createdAt).toLocaleDateString()}. Source: buildvision_demo_request. Request ID: ${req.id}.`,
    },
  });
  return created.id;
}

async function createNote(
  client: Client,
  contactId: string,
  req: DemoRequest
): Promise<void> {
  if (!req.message || req.message.trim() === "") return;

  const noteBody =
    `BuildVision Demo Request\n` +
    `Source: buildvision_demo_request\n` +
    `Request ID: ${req.id}\n` +
    `Submitted: ${new Date(req.createdAt).toLocaleString()}\n` +
    `Company: ${req.company || "(not provided)"}\n` +
    `Phone: ${req.phone || "(not provided)"}\n\n` +
    `Business Needs:\n${req.message}`;

  const engagement = await client.crm.objects.basicApi.create("notes", {
    properties: {
      hs_note_body: noteBody,
      hs_timestamp: new Date(req.createdAt).getTime().toString(),
    },
  });

  await client.crm.associations.v4.basicApi.create(
    "notes",
    engagement.id,
    "contacts",
    contactId,
    [{ associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined, associationTypeId: 202 }]
  );
}

async function associateContactCompany(
  client: Client,
  contactId: string,
  companyId: string
): Promise<void> {
  await client.crm.associations.v4.basicApi.create(
    "contacts",
    contactId,
    "companies",
    companyId,
    [{ associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined, associationTypeId: 1 }]
  );
}

async function associateContactDeal(
  client: Client,
  contactId: string,
  dealId: string
): Promise<void> {
  await client.crm.associations.v4.basicApi.create(
    "contacts",
    contactId,
    "deals",
    dealId,
    [{ associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined, associationTypeId: 3 }]
  );
}

export async function syncDemoRequestToHubSpot(req: DemoRequest): Promise<HubspotSyncResult> {
  const client = getClient();
  if (!client) return { status: "not_configured" };

  try {
    const [contactId, companyId] = await Promise.all([
      upsertContact(client, req),
      upsertCompany(client, req),
    ]);

    // Create deal only if no existing hubspotDealId stored on the record
    const dealId = req.hubspotDealId || (await createDeal(client, req));

    // Run associations + note — use Promise.all so any failure is surfaced as an error
    const tasks: Promise<void>[] = [];
    if (companyId) tasks.push(associateContactCompany(client, contactId, companyId));
    tasks.push(associateContactDeal(client, contactId, dealId));
    tasks.push(createNote(client, contactId, req));
    await Promise.all(tasks);

    return { status: "synced", contactId, companyId: companyId ?? undefined, dealId };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : String(err);
    return { status: "failed", error: trimError(raw) };
  }
}
