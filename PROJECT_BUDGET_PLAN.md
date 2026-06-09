# BuildVision — Project Budget Foundation Plan

**Phase:** 11E (Planning only — no schema migrations, no new routes, no UI changes)  
**Date:** 2026-06-09  
**Scope:** Estimate-to-Budget architecture, data model, workflow, and security design

---

## A. Current Codebase Findings

### What has been built (Phases 11A–11D)

| Phase | Outcome |
|---|---|
| 11A | Full audit of budget/price-book/estimate/invoice system |
| 11B | Added `companyId` directly to `estimates`, `invoices`, `recurringBilling`; backfill for legacy records |
| 11C | Connected company price book to Estimator via "From Price Book" tab |
| 11D | Opened Estimator + price book read routes to all internal company contractors; hardened estimate API access control |

### Current schema state (confirmed in `shared/schema.ts`)

**`projects`**
- `budget` (`numeric`) — single total number, no breakdown
- `budgetStatus` (`text`) — free-text label
- No `project_budgets` table, no per-category allocation

**`estimates`**
- `id`, `customId`, `clientName`, `projectName`, `amount`, `status`, `date`
- `projectId` (nullable FK → projects)
- `companyId` (FK → companies) ✅ added in Phase 11B
- No `sentAt`, `approvedAt`, `rejectedAt`, `rejectionReason` timestamps

**`estimate_line_items`**
- `id`, `estimateId` (FK), `category` (text), `item` (text)
- `quantity`, `unit`, `rate`, `total`
- **No `priceBookItemId` FK** — price book source is not tracked after item selection

**`invoices` / `recurringBilling`**
- Both have `companyId` ✅ added in Phase 11B

**`budget_categories` / `budget_items`** (dual-purpose price book)
- Serve both admin/platform library (`companyId IS NULL`) and company price book (`companyId = <uuid>`)
- `budget_items` has `burdens` and `subRate` columns — present in schema, **never used in any calculation**
- Floor Calculator classification uses `category.notes?.includes("Floor Calculator")` — fragile text heuristic

**No tables exist yet for:**
- `project_budgets` (per-project budget breakdown)
- `project_budget_items` (line-level budget allocation)
- `expenses` (actual cost tracking)
- `overhead_profiles` (per-company configurable overhead/profit)

### Current Estimator state (`client/src/pages/estimator.tsx`)

- Overhead hardcoded at **10%** of subtotal
- Profit hardcoded at **15%** of subtotal
- Grand total (`subtotal + overhead + profit`) is what gets saved as `estimates.amount`
- The overhead and profit *breakdown* is **never persisted** — only the final total is stored
- Phase 11C added "From Price Book" tab so users can pick items to pre-fill line item fields
- **Source `priceBookItemId` is not saved** to `estimate_line_items` when a price book item is selected

### Current financial pages

**`company-financials.tsx`** — Financial activity hub (audit log events). No budget-vs-actual data. Read-only.

**`accounting-dashboard.tsx`** — Invoice totals (outstanding, overdue, paid). Recurring billing. No expense data, no project budget data.

**`budget-admin.tsx`** — Price book management UI for company owners/admins. Shows `burdens` and `subRate` fields but they have no downstream effect on any calculation.

---

## B. Recommended Project Budget Data Model

### Core principle: one active budget per project, single source of truth

A project has one budget at a time. When an estimate is promoted to "project budget baseline," its line items are **copied** (snapshotted) into `project_budget_items`. The original estimate remains unchanged. Future change orders and expenses update the budget separately.

### Recommended new tables

#### `project_budgets`

The parent record — one per project (enforced by unique constraint on `projectId`).

```
project_budgets
  id               varchar PK (gen_random_uuid)
  projectId        varchar NOT NULL FK → projects(id)   [UNIQUE]
  companyId        varchar NOT NULL FK → companies(id)
  sourceEstimateId varchar NULLABLE FK → estimates(id)  -- which estimate seeded this budget
  title            text NOT NULL DEFAULT 'Project Budget'
  status           text NOT NULL DEFAULT 'draft'        -- draft | active | locked
  totalEstimated   numeric                              -- sum of budget item estimated costs
  totalActual      numeric DEFAULT 0                    -- updated as expenses are logged
  notes            text
  createdAt        timestamptz DEFAULT now()
  updatedAt        timestamptz DEFAULT now()
```

#### `project_budget_items`

Line-level breakdown — mirrors estimate line items but lives independently.

```
project_budget_items
  id                   varchar PK (gen_random_uuid)
  budgetId             varchar NOT NULL FK → project_budgets(id) ON DELETE CASCADE
  companyId            varchar NOT NULL FK → companies(id)
  projectId            varchar NOT NULL FK → projects(id)       -- denormalized for query convenience
  sourceEstimateItemId varchar NULLABLE FK → estimate_line_items(id) -- traceability
  priceBookItemId      varchar NULLABLE FK → budget_items(id)   -- original price book source (snapshot only)
  category             text NOT NULL   -- Labor | Materials | Equipment | Subcontractor | Permits | Overhead | Other
  description          text NOT NULL
  quantity             numeric NOT NULL DEFAULT 1
  unit                 text NOT NULL   -- EA | SF | LF | HR | LS | etc.
  unitCostEstimated    numeric NOT NULL DEFAULT 0
  unitCostActual       numeric NULLABLE               -- filled as expenses are logged
  totalEstimated       numeric NOT NULL DEFAULT 0     -- quantity × unitCostEstimated
  totalActual          numeric NULLABLE DEFAULT 0     -- updated as expenses are logged
  notes                text
  displayOrder         integer DEFAULT 0
  createdAt            timestamptz DEFAULT now()
```

### Why new tables rather than reusing existing ones

| Option | Problem |
|---|---|
| Reuse `estimate_line_items` as budget | Estimates are quotes — editable before approval. Budget is the committed baseline. Sharing the table conflates two distinct lifecycle stages. |
| Reuse `projects.budget` (single number) | No per-category breakdown, no actual-vs-estimated comparison, no traceability to estimate line items. |
| Add columns to `estimates` | Estimates can be revised, rejected, versioned. The budget is the committed baseline. Different concepts deserve different tables. |

### Deferred tables (pending business decisions)

| Table | Reason to defer |
|---|---|
| `expenses` | Actual cost tracking — needs business rules for what triggers `totalActual` updates |
| `overhead_profiles` | Requires formula decisions (see Section H) before modeling |

---

## C. Recommended Estimate-to-Budget Workflow

### Lifecycle

```
Estimate (draft)
  → Estimate (sent to client)
    → Estimate (approved)   ← recommended trigger point
      → [Create Project Budget from Estimate]
        → project_budgets record (status = active)
        → project_budget_items copied from estimate_line_items (snapshot)
        → projects.budget updated to match budget total
```

### Step-by-step user flow

1. Contractor creates and sends an estimate to the client.
2. Estimate is marked **approved** (internally by contractor, or later via client portal workflow).
3. Contractor clicks **"Create Project Budget from Estimate"** on the approved estimate.
4. System creates a `project_budgets` record with `sourceEstimateId` set.
5. System copies each `estimate_line_item` into a new `project_budget_item`:
   - `description`, `category`, `quantity`, `unit` copied as-is (snapshot)
   - `unitCostEstimated` = estimate line item `rate`
   - `totalEstimated` = estimate line item `total`
   - `sourceEstimateItemId` = source line item id (traceability)
   - `priceBookItemId` = copied from estimate line item if price-book-sourced (once that FK exists)
   - `totalActual` = null / 0 (not yet incurred)
6. `projects.budget` is updated to match `project_budgets.totalEstimated`.
7. The estimate **remains unchanged** — it is the historical quote record.

### Budget versioning approach

**Recommended: one active budget per project, revision via change orders.**

- Do not create multiple full budget versions at this stage — significant complexity for minimal initial value.
- Change orders (already built) are the mechanism for scope changes that affect the budget.
- When a change order is approved, its cost and timeline impact are already applied to `projects.budget` and `projects.dueDate`. In a future phase, they should also create new `project_budget_items` entries.
- "Archived revisions" are deferred until the business confirms the need.

### What does NOT happen automatically

- Estimate approval does **not** auto-create the budget — it is a deliberate contractor action.
- Budget creation does **not** lock the estimate from further editing.
- Budget creation does **not** auto-generate invoices.

---

## D. Price Book Snapshot / Linking Behavior

### Recommended approach: snapshot on copy, FK for traceability only

| Question | Recommendation |
|---|---|
| Should `estimate_line_items` store `priceBookItemId`? | **Yes** — add nullable `priceBookItemId` FK. Set it when the line item was populated from the price book. Leave null for manual entries. |
| Should `project_budget_items` store `priceBookItemId`? | **Yes** — copy from estimate line item if set. Enables future "re-price from price book" workflow. |
| Should copied items change when the price book changes? | **No** — always snapshot. The rate at the time of estimate creation is what was quoted. |
| Should price book price changes update existing budgets? | **No** — only future estimates should see new prices. Old quotes must not change unexpectedly. |
| Should there be a "re-price from current price book" action? | Possible future feature — would recalculate rates for un-approved estimates only. Approved estimates and active budgets must be protected. |

### Why snapshot behavior is correct

1. **Legal/contractual** — An estimate sent to a client is a financial commitment. Retroactive price changes would invalidate quotes already delivered.
2. **Audit integrity** — The project budget must reflect what was planned, not what prices are today.
3. **Simple reasoning** — Contractors can always create a new estimate if prices have changed.

### Required schema change (not yet done)

```sql
ALTER TABLE estimate_line_items
  ADD COLUMN price_book_item_id VARCHAR REFERENCES budget_items(id);
```

Set this FK when a line item is added via the "From Price Book" picker in the Estimator. Nullable — manual entries leave it null.

---

## E. Security / Scoping Requirements

### Access rules for all budget data

| Actor | Access |
|---|---|
| `admin` (platform) | Full read/write for support purposes |
| `company_owner` | Full read/write on their company's project budgets |
| `isCompanyAdmin` contractor | Full read/write on their company's project budgets |
| Internal contractor (no `contractorType`) | Read access to project budgets for their company's projects. Write access TBD. |
| `subcontractor` | No access to internal budget details unless a future assigned-scope workflow is intentionally built |
| `notary` | No access to internal budget details |
| `client` | No access to internal cost details. A "client-visible summary" (contract value only) could be intentionally added in the future, but full cost breakdown must remain internal. |

### companyId on every record (non-negotiable)

- `project_budgets.companyId` must be derived server-side from the verified project ownership chain. For company users, this should match `req.user.companyId`. For platform admins, derive `companyId` from the selected project. Never accept `companyId` from the request body.
- `project_budget_items.companyId` must be denormalized from the parent budget at creation.
- Every GET route must filter by `companyId`. Direct ownership check via `budget.companyId === user.companyId` — no indirect chain traversal.
- Budget creation must verify the target project belongs to the user's company.

### Middleware recommendation

Budget read routes: use `requireEstimateAccess` (already defined in `server/routes.ts`).  
Budget write routes: use `requireCompanyOwner`.

---

## F. UI Placement Recommendation

### Recommended structure

| Surface | What lives there |
|---|---|
| **Project Detail → Budget tab** | Primary home for the project budget. Estimated vs. actual by category. "Create Budget from Estimate" CTA if no budget exists. Per-line-item breakdown. |
| **Estimator → approved estimate** | "Create Project Budget" action button appears when estimate status = `approved`. Navigates to project Budget tab after creation. |
| **Company Financials** | Summary card: total estimated budget across all active projects vs. total actual (once expenses exist). Links to individual project Budget tabs. |
| **Budget Manager (`/company/budget`)** | Stays as price book management only. Does not become a project budget view — it would conflict with the price book's current purpose. |

### Why Project Detail → Budget tab is the right primary location

- Contractors think in project terms: "What is the budget for *this job*?"
- The project detail page already has tabs (Details, Estimates, Invoices, Messages, Team, Change Orders). A Budget tab fits naturally.
- Placing budget on the company financial hub would bury it under cross-project aggregates that most contractors don't need daily.
- The Estimator is the *creation* surface, not the *management* surface. Keep it focused on quote-building.

### Recommended tab order on project detail

`Details | Estimates | Budget | Invoices | Messages | Team | Change Orders`

Budget follows Estimates — matching the natural workflow direction.

---

## G. Recommended Next Build Phase (11F)

Recommended implementation order — each step is independently mergeable:

**Step 1 — Add `priceBookItemId` to `estimate_line_items`** (small, isolated)
- Nullable FK: `price_book_item_id VARCHAR REFERENCES budget_items(id)`
- Update storage insert/select for estimate line items
- Update Estimator "From Price Book" picker to pass `priceBookItemId` on line item creation
- No change to existing estimates — column is nullable, backfill not needed

**Step 2 — Add `project_budgets` and `project_budget_items` tables**
- Define Drizzle schemas in `shared/schema.ts`
- Run `db:push`
- Add storage methods: `getProjectBudget`, `createProjectBudget`, `updateProjectBudget`, `getProjectBudgetItems`, `createProjectBudgetItem`, `updateProjectBudgetItem`, `deleteProjectBudgetItem`

**Step 3 — API routes for project budget**
- `GET /api/projects/:id/budget` — returns budget + items; `requireEstimateAccess`
- `POST /api/projects/:id/budget` — creates budget, optionally from estimate; `requireCompanyOwner`
- `PATCH /api/projects/:id/budget` — updates header; `requireCompanyOwner`
- `POST /api/projects/:id/budget/items` — add item; `requireCompanyOwner`
- `PATCH /api/projects/:id/budget/items/:itemId` — update item; `requireCompanyOwner`
- `DELETE /api/projects/:id/budget/items/:itemId` — remove item; `requireCompanyOwner`
- `companyId` always injected server-side; direct ownership check on every request

**Step 4 — "Create Budget from Estimate" copy workflow**
- `POST /api/projects/:id/budget` with `{ sourceEstimateId }` triggers the copy
- Server reads estimate line items → copies to budget items as snapshot
- Updates `projects.budget` to match `totalEstimated`

**Step 5 — Budget tab UI on Project Detail**
- New Budget tab component in project detail page
- Budget summary card (total estimated, total actual placeholder)
- Per-category breakdown table (category, estimated, actual, variance)
- "Create Budget from Estimate" CTA when no budget exists
- Inline line item editing for company owners/admins
- Read-only view for internal contractors

**Defer to later phases:**
- Expense logging / actual cost tracking (`expenses` table)
- Budget-vs-actual reporting
- Per-company overhead profiles (requires formula decisions — see Section H)
- Client-visible budget summary

---

## H. Business / Formula Decisions Needed Before Coding

These must be answered by the business owner before any formula-related features are implemented.

### H1. Overhead and Profit Formula

| Question | Why it matters |
|---|---|
| Is the current 10% overhead + 15% profit correct for all job types? | These multipliers are hardcoded in `estimator.tsx`. A deploy is required to change them. |
| Should overhead/profit be configurable per company? Per estimate? | Determines whether an `overhead_profiles` table is needed or whether a simple company-level setting suffices. |
| Should overhead apply to all line item categories or only Labor? | Labor-only overhead is common in construction; all-category overhead is simpler to code. |
| Is there a separate tax percentage? | Adds another column to estimates and budgets if yes. |

### H2. `burdens` Field on Budget Items

The `budget_items.burdens` column exists and is editable in the Budget Admin UI but has zero effect on any calculation.

- Does "burdens" mean payroll tax burden (FICA, workers comp) as a **percentage** or **flat dollar amount**?
- Is it added to the labor rate per item, or applied as an aggregate multiplier on the labor subtotal?
- Is it internal cost-tracking only (never shown to client) or should it roll into the estimate total?

### H3. `subRate` Field on Budget Items

Same situation as `burdens` — present in schema, unused in all calculations.

- Is `subRate` the rate paid *to* a subcontractor for a given line item?
- Is it separate from `laborRate` (company's own crew rate), or does one replace the other depending on who performs the work?
- Should the estimator show both and let the contractor choose which applies?

### H4. "Near Me 1%" Fee

Referenced in prior product discussions. Clarify:
- Is this a 1% platform fee charged on estimate total, invoice total, or collected payments?
- Is it a contractor markup or a BuildVision platform fee?
- Which route/calculation should apply it, and who sees the line item?

### H5. Budget vs. Actual — What Triggers `totalActual` Updates?

Once an `expenses` table exists:
- Does logging an expense automatically update `project_budget_items.totalActual` for the matching category?
- Does approving a change order automatically add its cost to the active budget?
- Does marking an invoice as "paid" count as actual cost, or do invoices and expenses run as separate financial tracks?

### H6. Estimate Approval Workflow — Client-Facing or Internal?

- Should clients be able to approve/reject estimates from the client portal?
- If yes, does approval require e-signature (like change orders) or is a button click sufficient?
- Should an approved estimate automatically generate a draft invoice?
- Should an approved estimate lock the estimate from further editing?

### H7. Budget Read Access for Internal Contractors

Phase 11D gave internal contractors read access to estimates. Should they also have:
- Read access to the project budget? (Likely yes — they work on the project.)
- Write access to budget line items? (Likely no — probably owner/admin only.)

---

## Appendix — Current File Reference

| Area | File |
|---|---|
| Schema | `shared/schema.ts:104-203, 370-430` |
| Storage — estimates | `server/storage.ts` (`getEstimates`, `getEstimate`, `createEstimate`, `getEstimateLineItems`, `createEstimateLineItem`) |
| Storage — price book | `server/storage.ts` (`getCompanyPriceBookCategories`, `getCompanyPriceBookItems`, `getCompanyPriceBookItemsByCategory`) |
| Estimate routes | `server/routes.ts:2492-2620` |
| Estimate access middleware | `server/routes.ts` (`requireEstimateAccess`, ~line 794) |
| Price book routes (company) | `server/routes.ts` (~4892–4990) |
| Estimator UI | `client/src/pages/estimator.tsx` |
| Financial hub | `client/src/pages/company-financials.tsx` |
| Budget admin UI | `client/src/pages/budget-admin.tsx` |
| Accounting dashboard | `client/src/pages/accounting-dashboard.tsx` |
| Floor calculator | `client/src/pages/floor-calculator.tsx` |
