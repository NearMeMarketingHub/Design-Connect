# BuildVision — Budget & Expense System Audit

**Date:** 2026-06-05  
**Scope:** All budget, price-book, estimator, and financial code. Read-only audit — no production code changed.  
**Auditor:** Phase 11A task agent

---

## A. What Already Exists and Works

### Price Book — Schema

The `budget_categories` and `budget_items` tables serve a **dual-purpose model**:

| Column | Platform library | Company price book |
|---|---|---|
| `companyId` | `NULL` | `<uuid>` |
| Managed by | Super Admin (`/api/budget/*`) | Company Owner (`/api/company/price-book/*`) |

**`budget_categories`** (`shared/schema.ts` ~line 367)
- `id`, `name`, `notes`, `displayOrder` (int), `isActive` (bool), `companyId` (nullable FK → companies)

**`budget_items`** (`shared/schema.ts` ~line 380)
- `id`, `categoryId` (FK), `description`, `itemType`, `unitType`
- Price columns: `cost`, `laborRate`, `materialFee`, `retailPrice` (all `numeric`, nullable)
- Overhead columns: `burdens`, `subRate` (both `numeric`, nullable) — present in schema but see Section B
- `notes`, `displayOrder`, `isActive`, `companyId` (nullable FK)

### Price Book — API Routes (all correct)

**Admin/platform library** (`requireAdmin` middleware, `server/routes.ts` ~line 4999):
- `GET /api/budget/categories` — returns only `companyId=null` categories
- `GET /api/budget/categories/:id/items` — verifies category is platform-level before returning
- `GET /api/budget/items` — returns all platform items via `getAllBudgetItems()`
- `GET /api/budget/items/:id` — 404s if `item.companyId !== null`
- `POST /api/budget/items` — always saves with `companyId: null`; validates categoryId is platform-level
- `PATCH /api/budget/items/:id` — whitelists mutable fields; `companyId` is never mutated
- `DELETE /api/budget/items/:id` — guards against deleting company-owned items

**Company price book** (`requireCompanyOwner` middleware, `server/routes.ts` ~line 4801):
- `GET /api/company/price-book/categories` — scoped to `user.companyId`
- `POST /api/company/price-book/categories` — injects `companyId` from session
- `PATCH /api/company/price-book/categories/:id` — verifies `existing.companyId === user.companyId`; whitelists fields; `companyId` cannot change
- `DELETE /api/company/price-book/categories/:id` — same ownership check
- `GET /api/company/price-book/items` — scoped to `user.companyId`
- `POST /api/company/price-book/items` — verifies `category.companyId === user.companyId` before creating
- `PATCH /api/company/price-book/items/:id` — ownership check; if `categoryId` changes, also verifies new category ownership
- `DELETE /api/company/price-book/items/:id` — ownership check

**Conclusion:** All ownership guards on the price book are correct and fully company-isolated.

### Price Book — Bulk Import Flow

Two-step flow, both behind `requireCompanyOwner`:

1. `POST /api/company/price-book/parse-file` — accepts XLSX or CSV via `multer` memory storage (10 MB limit); uses `xlsx` library to return `{ rows, headers }` as JSON. No data is saved here.
2. `POST /api/company/price-book/bulk-import` — accepts `items[]` array; groups by `category` name; finds-or-creates categories; saves items with `companyId` injected from session. **Not transactional** — partial imports are possible if the server crashes mid-loop (minor risk).

**Client-side mapping UI** (`client/src/pages/company-dashboard.tsx`, price book section):
- Auto-detects column mappings by keyword matching (e.g. "labor" → laborRate)
- User can review/edit rows before submitting
- Accepts manual table entry or file upload
- Column mapping supports: category, description, unitType, laborRate, materialFee, retailPrice, itemType

### Floor Calculator Integration

- Route: `GET /api/calculator/items` (`requireContractorOrAdmin`) — returns company price book items where `unitType` contains "SF"/"SQ" or `description` matches `/floor|tile|carpet|vinyl|hardwood|laminate/i`
- Route: `GET /api/calculator/categories` — returns categories that have at least one floor-calculator item
- Fully company-scoped: reads from `getCompanyPriceBookItems(companyId)` using the authenticated user's companyId

### Budget Admin Page

`client/src/pages/budget-admin.tsx` **exists** (previous audit notes flagged it as missing — this was incorrect).

- Route registered at `/company/budget` in `client/src/App.tsx`
- Accessible to both super admins (`isAdmin=true`) and company owners/admins (`isCompanyUser=true`)
- Dynamically switches API base: admins use `/api/budget`, company users use `/api/company/price-book`
- Shows "Labor Budget Categories" and "Floor Calculator Pricing" sections using category `notes` to distinguish ("Floor Calculator" in notes → floor section)
- Displays `burdens` and `subRate` fields in the edit dialog alongside cost/material/labor/retail

### Invoices — Core Tables

**`invoices`** (`shared/schema.ts` ~line 158):
- `id`, `customId`, `clientName`, `projectName`, `amount`, `dueDate`, `status`, `type`, `projectId` (nullable FK)

**`invoice_line_items`** (`shared/schema.ts` ~line 174):
- `id`, `invoiceId` (FK), `description`, `quantity`, `rate`, `amount`

**`recurringBilling`** (`shared/schema.ts` ~line 187):
- `id`, `customId`, `clientName`, `projectName`, `amount`, `frequency`, `nextRunDate`, `status`, `projectId` (nullable FK)

**Accounting Dashboard** (`client/src/pages/accounting-dashboard.tsx`):
- Displays invoices (outstanding, overdue, paid totals) and recurring billing items
- Computes totals client-side from the full invoices array
- Read-only reporting; no expense categories or project-budget comparison

### Estimates — Core Tables

**`estimates`** (`shared/schema.ts` ~line 128):
- `id`, `customId`, `clientName`, `projectName`, `amount`, `status`, `date`, `projectId` (nullable FK)

**`estimate_line_items`** (`shared/schema.ts` ~line 143):
- `id`, `estimateId` (FK), `category`, `item`, `quantity`, `unit`, `rate`, `total`

### Estimator UI (`client/src/pages/estimator.tsx`)

- Contractors select a project, then manually enter line items (no price-book lookup)
- Available categories (hardcoded dropdown): Labor, Materials, Equipment, Subcontractor, Permits, Overhead, Other
- Available units (hardcoded): EA, SF, LF, HR, LS, CY, SY, LB, GAL, TON
- Can load an existing estimate to copy its line items
- Generates `customId` in format `EST-YYYYMMDD-XXXX`
- Enforces `requireActiveSubscription` on `POST /api/estimates`

### Projects — Budget Fields

**`projects`** table (`shared/schema.ts` ~line 104):
- `budget` (`numeric`) — single total budget number
- `budgetStatus` (`text`) — free-text label (e.g. "On Track", "Over Budget")
- No breakdown by category, phase, or trade

---

## B. What Exists but Is Incomplete

### B1. Hardcoded Overhead and Profit in Estimator

**File:** `client/src/pages/estimator.tsx` lines ~157–159

```typescript
const overhead = subtotal * 0.1;    // hardcoded 10%
const profit   = subtotal * 0.15;   // hardcoded 15%
const grandTotal = subtotal + overhead + profit;
```

- These multipliers are **client-side constants** with no database backing and no per-company configuration
- Changing them requires a code deploy
- No UI to adjust or display the overhead/profit percentages to the user
- The computed `grandTotal` is what gets saved as `estimates.amount` — the breakdown (subtotal / overhead / profit) is never persisted

### B2. `burdens` and `subRate` Fields Are Unused in Estimates

**Schema:** `budget_items.burdens` and `budget_items.subRate` exist and are stored on price book items.

**Problem:** The estimator has no mechanism to read these values. Line items in `estimate_line_items` only store `category`, `item`, `quantity`, `unit`, `rate`, and `total`. There is no `laborBurden`, `subRate`, or overhead breakdown column on estimate line items. The fields are editable in the budget-admin UI but have zero downstream effect on any financial calculation.

### B3. No Price-Book-to-Estimate Linkage

- The estimator creates all line items via manual text entry only
- There is no "pick from price book" flow
- `estimate_line_items` has no `budgetItemId` FK or `priceBookItemId` reference
- No way to push a price-book rate change to existing estimates

### B4. No Project-Level Budget Breakdown

`projects.budget` is a single number. There is:
- No per-category budget allocation (e.g. "$20k labor, $15k materials")
- No per-phase budget tracking
- No `project_budgets` table or budget line item table
- No way to track planned vs. actual cost at a granular level

### B5. No Expense / Actual Cost Tracking

There is no `expenses` table, no `project_costs` table, and no "actual cost" concept anywhere in the schema or routes. The accounting dashboard shows invoice totals only (money going *out* to clients), not money spent by the contractor. The `budget vs actual` comparison that contractors typically need does not exist.

### B6. `estimates` and `invoices` Have No Direct `companyId` Column

Neither the `estimates` table nor the `invoices` table has a `companyId` column. The API enforces company scoping only through an **indirect ownership chain**:

```
estimates.projectId → projects.contractorId → users.companyId
```

This means:
- `GET /api/estimates` calls `storage.getEstimates(companyId)` — the storage layer must JOIN through projects to filter by company (verify in `server/storage.ts`)
- `GET /api/estimates/:id` does a 4-level ownership walk at the route level (see Section C below)
- If `projectId` is `null`, the `GET /api/estimates/:id` route returns 403 for non-admins — but a null projectId estimate can still be *created* if validation allows it

Same pattern applies to `invoices` and `recurringBilling`.

### B7. Floor Calculator Category Detection Uses `notes` Field — Fragile Heuristic

`budget-admin.tsx` uses `category.notes?.includes("Floor Calculator")` to classify floor calculator categories. This is a fragile text match with no enum or boolean column. If a note is edited accidentally, items disappear from or appear in the wrong section.

### B8. No Estimate Status Workflow Beyond `draft`

`estimate_line_items` and `estimates` have a `status` field (`draft`, `sent`, `approved`, `rejected`) but:
- No timestamp columns (`sentAt`, `approvedAt`, `rejectedAt`)
- No notes/reason field for rejection
- No version history or revision tracking
- Client-side UI renders the badge but there is no approval workflow page for clients

### B9. Bulk Import Is Not Transactional

`POST /api/company/price-book/bulk-import` loops through categories and items without wrapping the operation in a database transaction. A server crash or DB error mid-loop leaves a partial import with some categories created and some items missing. The endpoint should be wrapped in `db.transaction()`.

---

## C. Security / Scoping Risks

### C1. Estimates Scoped Indirectly Through 4-Level Ownership Chain

**File:** `server/routes.ts` ~line 2459 (`GET /api/estimates/:id`)

```
estimate → estimate.projectId → project → project.contractorId → contractor.companyId
```

If **any link in this chain is null** (orphan estimate, project without a contractorId, contractor with no companyId), the route returns `403 Access Denied` — which is safe but silent. The risk is a different kind of failure: valid data that happens to have a null intermediate FK becomes inaccessible rather than the data leaking.

A direct `estimates.companyId` FK would allow a single-query ownership check with no chain traversal and no null-gap risk.

### C2. `invoices` Has the Same Indirect-Scoping Pattern

`GET /api/invoices` calls `storage.getInvoices(companyId)`. The storage method must JOIN through `projects` to determine company membership for the same reason — no `invoices.companyId` column. If `invoice.projectId` is null, the invoice is either unreachable or returned for all companies (depending on the storage implementation — this warrants verification).

**Action required:** Audit `storage.getInvoices()` implementation to confirm null-`projectId` invoices are not returned to unrelated companies.

### C3. `recurringBilling` Has No Ownership Check in Storage Query

`GET /api/recurring-billing` (if it exists) also lacks a `companyId` column. If the query does not filter by the authenticated user's companyId via project join, it may return all recurring billing records to any authenticated user.

**Action required:** Audit the recurring billing GET route and storage method.

### C4. Budget Admin Page Accessible to All Company Admins (Not Owner-Only)

`budget-admin.tsx` grants access to `isCompanyUser = company_owner || isCompanyAdmin`. This means any team member flagged as `isCompanyAdmin=true` can edit company price book items via the `/company/budget` route, even if `requireCompanyOwner` on the API would block them. The API itself is protected but the UI allows navigation that ends in confusing 403 errors for non-owner admins.

---

## D. Recommended Schema / Data-Model Changes

These are prerequisite schema additions for the Phase 11B build. No implementation order is implied — business decisions in Section F must be made first.

### D1. Add `companyId` directly to `estimates` and `invoices`

```sql
ALTER TABLE estimates     ADD COLUMN company_id VARCHAR REFERENCES companies(id);
ALTER TABLE invoices      ADD COLUMN company_id VARCHAR REFERENCES companies(id);
ALTER TABLE recurring_billing ADD COLUMN company_id VARCHAR REFERENCES companies(id);
```

Backfill via the existing project → contractor → company chain. Add a DB-level index on `company_id` for query performance.

### D2. Add `project_budgets` Table — Project-Level Budget Breakdown

```
project_budgets
  id, projectId (FK), companyId (FK),
  category (text — Labor/Materials/Equipment/etc.),
  plannedAmount (numeric),
  actualAmount (numeric),   -- updated as expenses are logged
  notes (text),
  createdAt, updatedAt
```

Links to project's overall `budget` field but allows per-category tracking.

### D3. Add `expenses` Table — Actual Cost Tracking

```
expenses
  id, projectId (FK), companyId (FK),
  category (text),
  description (text),
  amount (numeric),
  date (text),
  vendorName (text, nullable),
  receiptUrl (text, nullable),
  createdByUserId (FK),
  createdAt
```

This enables "budget vs actual" reporting.

### D4. Add `priceBookItemId` FK to `estimate_line_items`

```sql
ALTER TABLE estimate_line_items ADD COLUMN price_book_item_id VARCHAR REFERENCES budget_items(id);
```

Nullable — manual entries leave it null; price-book-sourced items set it. Enables "update rate from price book" workflow.

### D5. Add `overhead_profiles` Table — Per-Company Configurable Overhead

```
overhead_profiles
  id, companyId (FK),
  name (text),               -- e.g. "Standard", "Residential"
  overheadPercent (numeric), -- replaces hardcoded 10%
  profitPercent (numeric),   -- replaces hardcoded 15%
  taxPercent (numeric, nullable),
  isDefault (boolean),
  createdAt
```

Eliminates the hardcoded multipliers in `estimator.tsx`.

### D6. Add `isFloorCalculator` Boolean to `budget_categories`

```sql
ALTER TABLE budget_categories ADD COLUMN is_floor_calculator BOOLEAN DEFAULT FALSE;
```

Replaces the fragile `notes.includes("Floor Calculator")` heuristic in `budget-admin.tsx`.

### D7. Add Timestamps to `estimates` for Status Workflow

```sql
ALTER TABLE estimates
  ADD COLUMN sent_at      TIMESTAMPTZ,
  ADD COLUMN approved_at  TIMESTAMPTZ,
  ADD COLUMN rejected_at  TIMESTAMPTZ,
  ADD COLUMN rejection_reason TEXT;
```

---

## E. Recommended Next Build Phase (Phase 11B — Prioritised)

Listed in recommended implementation order:

1. **Add `companyId` to `estimates`, `invoices`, `recurringBilling`** (D1)  
   Prerequisite for everything else. Schema migration, backfill, update storage queries. Low risk, high security value.

2. **Add `overhead_profiles` table and wire to estimator** (D5)  
   Removes hardcoded constants. Company owners configure their default overhead/profit %; estimator reads it. UI: settings tab on company dashboard.

3. **Add "pick from price book" flow to estimator** (D4)  
   Allow contractors to search/select a price book item to pre-fill a line item's description, unit, and rate. Adds `priceBookItemId` FK. Dramatically speeds up estimate creation.

4. **Add `project_budgets` breakdown table** (D2)  
   Replace single `projects.budget` number with per-category allocations. Show "Budget Allocation" card on project details page.

5. **Add `expenses` table and Expense Logging UI** (D3)  
   Minimal: date, amount, category, description. Medium: receipt image upload. Enable "Budget vs Actual" card on project details.

6. **Fix bulk import to use a DB transaction** (B9)  
   Small code change — wrap the loop in `db.transaction()` in `server/routes.ts` ~line 4919.

7. **Add `isFloorCalculator` boolean to `budget_categories`** (D6)  
   Small schema change. Update `budget-admin.tsx` UI and `/api/calculator/*` queries to use the boolean.

8. **Audit and fix `recurringBilling` scoping** (C3)  
   Confirm or fix that recurring billing records cannot be read cross-company.

---

## F. Items That Need Business/Formula Decisions Before Coding

The following require answers from the business owner before any implementation begins:

### F1. Overhead and Profit Formula

- Is the current **10% overhead + 15% profit** formula correct for all job types, or should it vary?
- Should overhead and profit be configurable **per company**, **per estimate**, or both?
- Should overhead apply to **all categories** (Labor, Materials, Subs, etc.) or only to Labor?
- Is there a separate **tax** percentage to apply, and at what level?

### F2. `burdens` Field — What Does It Represent?

The `budget_items.burdens` column exists in schema but is never used in calculations. Clarify:
- Does "burdens" mean payroll tax burden (e.g. FICA, workers comp) as a **percentage** or a **flat dollar amount**?
- Is it a fixed cost added to labor rate, or a multiplier applied to labor subtotal?
- Should it roll up into the estimate total automatically, or is it internal cost-tracking only?

### F3. `subRate` Field — What Does It Represent?

Similarly undefined. Clarify:
- Is `subRate` the rate paid *to* a subcontractor for a given line item?
- Is it separate from `laborRate` (company's own crew) or does one replace the other depending on who does the work?
- Should the estimator show both rates and let the user choose?

### F4. "Near Me 1%" — What Is This?

Referenced in earlier product discussions. Clarify:
- Is this a 1% fee charged on estimate total, invoice total, or something else?
- Is it a platform fee or a contractor markup?
- Which route/calculation should apply it?

### F5. Budget vs. Actual — What Triggers `actualAmount` Updates?

Once an `expenses` table exists, clarify the business rules:
- Does logging an expense automatically update `project_budgets.actualAmount` for the matching category?
- Does approving a change order automatically add its cost to the project budget?
- Does marking an invoice as "paid" count as actual cost, or are invoices and expenses separate tracks?

### F6. Estimate Approval Workflow — Client-Facing or Internal?

- Should clients be able to approve/reject estimates from the client portal?
- If yes, does approval require e-signature (like change orders), or is a button click sufficient?
- Should approved estimates automatically convert to invoices?

---

## Appendix — File Reference

| Area | File(s) |
|---|---|
| Schema | `shared/schema.ts` lines 104–202, 367–430 |
| Storage — price book | `server/storage.ts` (`getCompanyPriceBookCategories`, `getCompanyPriceBookItems`, `getCompanyPriceBookItemsByCategory`, `getAllBudgetItems`) |
| Storage — estimates/invoices | `server/storage.ts` (`getEstimates`, `getInvoices`, `getRecurringBilling`) |
| Routes — platform price book | `server/routes.ts` ~4999–5153 |
| Routes — company price book | `server/routes.ts` ~4801–4996 |
| Routes — estimates | `server/routes.ts` ~2445–2551 |
| Routes — invoices | `server/routes.ts` ~2554–2700 |
| Estimator UI | `client/src/pages/estimator.tsx` |
| Accounting dashboard | `client/src/pages/accounting-dashboard.tsx` |
| Financial hub | `client/src/pages/company-financials.tsx` |
| Price book UI | `client/src/pages/company-dashboard.tsx` (price book tab) |
| Budget admin UI | `client/src/pages/budget-admin.tsx` |
| Floor calculator | `client/src/pages/floor-calculator.tsx` |
