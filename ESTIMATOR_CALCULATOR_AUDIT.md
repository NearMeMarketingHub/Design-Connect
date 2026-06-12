# Estimator Calculator Audit

_Phase 12D Patch 1 — audit only, no production changes_  
_All findings verified against actual code as of this audit._

---

## 1. Current Route & Page Summary

### `/contractor/calculator` → `client/src/pages/contractor-calculator.tsx` (555 lines)

**What it does today:**
- Fetches company Price Book via `/api/calculator/categories` and `/api/calculator/items`
- Three-column meeting-friendly layout: category list | searchable item table | estimate cart
- Add items to cart, adjust quantities with +/- buttons, remove items
- Cart computes labor total, materials total, retail total, profit margin in real time
- "Save Estimate" dialog collects `estimateName` and `estimateNotes` — **the save handler is a stub**: it fires a toast `"Full save functionality coming soon."` and resets the dialog; no API call is ever made (verified: `contractor-calculator.tsx` lines 535–543)
- No prospect/client name inputs
- No project selector
- No PDF, print, or export functionality

**Sidebar access:** Yes — "Estimator Calculator" entry in contractor sidebar (`layout.tsx` line 72)

**What's good:** Meeting-friendly layout, live price book integration, cart UX, real-time totals with margin.  
**What's missing:** Actual persistence (save is a stub), client/prospect info, PDF export, optional project link.

---

### `/company/estimates` → `client/src/pages/estimator.tsx` (934 lines)

**What it does today:**
- Requires selecting an existing project before saving — `handleSave` returns early with a toast if `!selectedProjectId || !selectedProject` (verified: lines 308–310)
- Manual line item entry form with category, item, quantity, unit, rate fields
- "From Price Book" tab in the add-item panel reads `/api/company/price-book/categories` and `/api/company/price-book/items`; selecting an item pre-fills the manual form and stores `priceBookItemId`
- Saves via `POST /api/estimates` with the full line item payload (including `priceBookItemId`)
- Auto-loads an estimate from `?load=id` URL param on mount
- Shows saved estimates list in a side panel; clicking loads that estimate into the editor
- Displays financial summary: subtotal, 10% overhead, 15% profit, grand total
- No PDF, print, or export functionality

**Sidebar access:** No — reached only from the Company Financials quick-access card and the Sales Dashboard "Create Quote" button  
**What's good:** Full estimate persistence, line item management, project association, price book integration, saved estimates list, load-by-URL-param.  
**What's missing:** Pre-project/prospect quoting (project is currently required), PDF export.

---

## 2. Data Model Findings

### `estimates` table — `shared/schema.ts` lines 128–138 (verified)

| Column | Type | Constraint | Notes |
|---|---|---|---|
| `id` | varchar PK | auto UUID | — |
| `customId` | text | NOT NULL | e.g. `EST-20260612-A3F2` |
| `clientName` | text | NOT NULL | Free-text — can hold a prospect name without schema change |
| `projectName` | text | NOT NULL | Free-text — can hold a job/quote description without schema change |
| `amount` | numeric | NOT NULL | Grand total |
| `status` | text | NOT NULL | `draft` / `sent` / `approved` / `rejected` |
| `date` | text | NOT NULL | ISO date string |
| `projectId` | varchar | **nullable** FK → projects | No `.notNull()` — already optional at DB level |
| `companyId` | varchar | **nullable** FK → companies | Set server-side; not required by schema |

**Key finding: `projectId` is already nullable in the database schema. No `db:push` is needed to support projectless estimates.**

`clientName` and `projectName` are free-text NOT NULL fields — a contractor can enter a prospect's name and job description into these fields without any schema change. No new columns are needed for basic pre-project quoting.

### `estimate_line_items` table — `shared/schema.ts` lines 144–154 (verified)

| Column | Type | Constraint | Notes |
|---|---|---|---|
| `id` | varchar PK | auto UUID | — |
| `estimateId` | varchar | NOT NULL FK → estimates | — |
| `category` | text | NOT NULL | — |
| `item` | text | NOT NULL | Line item description |
| `quantity` | numeric | NOT NULL | — |
| `unit` | text | NOT NULL | EA / SF / LF / HR / LS etc. |
| `rate` | numeric | NOT NULL | Per-unit price |
| `total` | numeric | NOT NULL | `quantity × rate` |
| `priceBookItemId` | varchar | **nullable** FK → budgetItems | Price book linkage already modeled |

**Price book item IDs are already stored on estimate line items.** The link back to the source price book item exists in the current schema.

### Missing field: `notes`

No `notes` column exists on the `estimates` table (verified — only 8 columns). The contractor-calculator save dialog collects `estimateNotes` but since the save is a stub, it never reaches the DB. If notes are required in the saved record or PDF, a nullable `notes text` column would need to be added to `estimates` — this would require `db:push` and is the only schema change identified.

---

## 3. API Route Findings

### `createEstimateSchema` — `server/routes.ts` lines 2236–2245 (verified)

```
projectId: z.string().optional().nullable()
```

`projectId` is **already optional at the Zod validation layer.** The schema itself does not require it.

### `POST /api/estimates` — projectId enforcement — lines 2605–2607 (verified)

```javascript
if (user.role !== "admin") {
  if (!estimateData.projectId) {
    return res.status(403).json({ message: "Access denied: a project must be associated with this estimate" });
  }
  // derive companyId via: project → project.contractorId → contractor.companyId
```

**This is a soft API-level block, not a schema constraint.** For non-admin users (contractors, company owners), the API currently rejects any estimate that has no `projectId`. This check exists solely to guarantee a `companyId` can be derived — the current derivation chain is `projectId → project.contractorId → contractor.companyId`.

**The fix for pre-project estimates is straightforward and confined to this block:** when `projectId` is absent, derive `companyId` directly from `user.companyId` (available on the session user object). The rest of the route — line item validation, priceBookItemId ownership checks, broadcast, audit log — continues to work unchanged.

### `GET /api/estimates` — line 2542 (verified via grep)

Fetches estimates by `companyId`. Already works correctly for projectless estimates — no change needed.

### `GET /api/estimates/:id` — line 2556 (verified via grep)

Ownership guard checks `estimate.companyId === user.companyId` when `companyId` is set. Projectless estimates created with a direct `companyId` will pass this check correctly — no change needed.

---

## 4. Price Book Connection Findings

### `/contractor/calculator`
- Reads from `/api/calculator/categories` and `/api/calculator/items`
- Items are displayed in the searchable table; `retailPrice` is used for the cart total
- Each `BudgetItem` carries a `priceBookItemId` (`id` field) — available to pass through on save
- Not currently passed through because the save is a stub

### `/company/estimates`
- Reads from `/api/company/price-book/categories` and `/api/company/price-book/items`
- "From Price Book" tab pre-fills the manual line item form; `priceBookItemId` is stored in form state and passed in the `POST /api/estimates` payload
- Server-side validates `priceBookItemId` ownership: `pbItem.companyId !== derivedCompanyId` → 400

### Access control
- Price book **reads** are available to all internal company contractors (company_owner, isCompanyAdmin, regular contractor with `companyId` and no `contractorType`)
- Price book **writes** (create/update/delete categories and items) are restricted to company_owner and isCompanyAdmin
- Subcontractors and notaries are excluded from price book access

**Both pages already connect to the company Price Book. `priceBookItemId` is already modeled on estimate line items for full traceability from quote line → price book item.**

---

## 5. PDF / Export Findings

### Installed PDF libraries (verified: `package.json` lines 52–88)

| Package | Version | Current use |
|---|---|---|
| `jspdf` | `^4.0.0` | Floor plan export only |
| `pdf-lib` | `^1.17.1` | E-signature (PDF manipulation for signing) |
| `pdfjs-dist` | `^5.4.530` | E-signature (PDF viewer for signing page) |
| `react-pdf` | `^10.3.0` | E-signature (PDF rendering in signing page) |
| `@types/react-pdf` | `^6.2.0` | Type definitions |

### Existing jsPDF usage pattern

`client/src/pages/3d-floor-plan.tsx` uses `jsPDF` to export multi-page floor plan PDFs:
- `new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" })`
- `pdf.setFontSize()` / `pdf.setFont()` / `pdf.text()` for headings and text
- `pdf.addImage(dataUrl, "PNG", x, y, w, h)` for canvas screenshots
- `pdf.addPage()` for multi-page documents
- `pdf.save("filename.pdf")` to trigger browser download

This pattern is already proven in the codebase and directly reusable for estimate PDFs.

### No estimate/invoice PDF export exists (verified)

Grep of both `contractor-calculator.tsx` and `estimator.tsx` for `pdf`, `PDF`, `print`, `export` returned only the function declaration lines — confirmed zero PDF or print functionality in either estimator page.

### Recommendation: client-side jsPDF

Client-side jsPDF (same pattern as floor plan exporter) is the right approach:
- No new server route or dependency needed — jsPDF is already installed
- Can produce a professional multi-section quote PDF:
  - Company name / header
  - Estimate number, date, status
  - Client / prospect name and job description
  - Line items table (category, item, qty, unit, rate, total)
  - Subtotals (labor, materials), grand total, margin
  - Optional notes
- `pdf.save("estimate-EST-XXXXXX.pdf")` triggers browser download
- User can print the downloaded PDF or share it digitally

---

## 6. Recommended Implementation Approach

### Option B: API-only update + frontend build-out (no schema migration)

This is the correct path. The database schema already supports pre-project estimates. The only blocking constraint is the API-level `projectId` enforcement added to guarantee `companyId` derivation.

| Item | Type of change | db:push? |
|---|---|---|
| Lift non-admin `projectId` hard requirement in `POST /api/estimates`; derive `companyId` from `user.companyId` when no project | API-only, ~5 lines in `server/routes.ts` | **No** |
| Wire up contractor-calculator save button to `POST /api/estimates` | Frontend-only | **No** |
| Add prospect/client name + job description inputs to contractor-calculator save dialog | Frontend-only | **No** |
| Add optional project selector to contractor-calculator save dialog | Frontend-only | **No** |
| Add PDF export using jsPDF | Frontend-only (library already installed) | **No** |
| Add `notes text` nullable column to `estimates` table _(optional)_ | Schema change | **Yes, if desired** |

**No `db:push` is required for the core feature.** The notes field is the only optional schema addition.

---

## 7. Final Desired Workflow

1. **Company Owner/Admin** sets up the Price Book in Budget Manager (`/company/budget`)
2. **Contractor** opens **Estimator Calculator** from the sidebar (`/contractor/calculator`)
3. Contractor enters prospect/client name and job/quote description (free-text inputs — no project required)
4. Contractor optionally selects an existing project from a dropdown (not required)
5. Contractor builds quote by picking items from the company Price Book and/or adding manual line items
6. Contractor reviews real-time totals: labor, materials, retail price, profit margin
7. Contractor clicks **Save Estimate** → saved to DB via `POST /api/estimates` as `status: "draft"` with `companyId` derived from session
8. Contractor clicks **Export PDF** → jsPDF generates and downloads a professional quote PDF instantly
9. Contractor prints the PDF or saves/sends it digitally to the prospect
10. Later, if the quote is accepted, the saved estimate can be linked to a new or existing project and optionally used to seed a project budget

---

## 8. Recommended Final Route & UI Structure

**Primary route:** `/contractor/calculator` — keep as-is (already in sidebar, meeting-friendly layout)  
**Secondary route:** `/company/estimates` — keep as-is (project-based estimate management, used from Sales Dashboard and Company Financials)

These serve genuinely different use cases and should coexist:

| Route | Purpose | Audience |
|---|---|---|
| `/contractor/calculator` | **Quick Quote Builder** — pre-project, meeting-friendly, price book picker, PDF export | Any internal contractor |
| `/company/estimates` | **Estimate Manager** — saved estimate list, project-associated, admin/owner view | Company owners, admins |

### Recommended UI for `/contractor/calculator` after build

```
Estimator Calculator
"Create project estimates and quotes using your company price book."

┌─ Categories ──┬─ Item Table (searchable) ──┬─ Estimate Cart ───────────────────┐
│ All Items     │ Description | Unit | Labor  │ Client Name: [______________]     │
│ Electrical    │ Material    | Price | [+]   │ Job Description: [______________] │
│ Plumbing      │ ...                         │ Project (optional): [select ▼]    │
│ Flooring      │                             │ ─────────────────────────────     │
│ ...           │                             │ [item] qty × rate = total [×]     │
│               │                             │ ─────────────────────────────     │
│               │                             │ Labor:     $X,XXX                 │
│               │                             │ Materials: $X,XXX                 │
│               │                             │ Total:     $X,XXX                 │
│               │                             │ Margin:    XX%                    │
│               │                             │ ─────────────────────────────     │
│               │                             │ [Save Estimate] [Export PDF]      │
└───────────────┴─────────────────────────────┴───────────────────────────────────┘
```

---

## 9. Schema / API Risks

| Risk | Severity | Notes |
|---|---|---|
| `POST /api/estimates` blocks non-admin saves without `projectId` | **Must fix** | One-location API change (lines 2605–2607); derive `companyId` from `user.companyId` directly |
| `clientName` and `projectName` are NOT NULL — must be collected before saving | **Must handle** | Collect client name + job description in the cart panel or save dialog (pre-filled, visible, not buried) |
| No `notes` column on `estimates` | Low / optional | Can omit from DB record and still include in PDF; add nullable column + `db:push` only if persistence is required |
| `priceBookItemId` ownership validation in API requires `derivedCompanyId` to be non-null | Already handled | With direct `user.companyId` derivation, this check will still work correctly |
| Floating-point total validation in API: `Math.abs(total − qty × rate) > 0.01` | None | Contractor-calculator already computes `qty × retailPrice`; pass the same computed value as `total` |
| `estimateNotes` field collected in current save dialog has no DB column | Low | Either drop `estimateNotes` from the dialog, or add a `notes` column if persistence is required |

---

## 10. Suggested Build Steps for Next Phase

### Step 1 — API: lift projectId requirement (`server/routes.ts` ~line 2605)
Replace the current block:
```javascript
if (user.role !== "admin") {
  if (!estimateData.projectId) {
    return res.status(403).json({ message: "..." });
  }
  // derive companyId from project chain
```
With:
```javascript
if (user.role !== "admin") {
  if (estimateData.projectId) {
    // existing project-chain derivation (unchanged)
  } else {
    // Pre-project quote: derive companyId from session user directly
    if (!user.companyId) {
      return res.status(403).json({ message: "Access denied: no company associated with your account" });
    }
    derivedCompanyId = user.companyId;
  }
```

### Step 2 — Contractor-calculator: add client info inputs and real save
- Add `clientName` (required) and `projectName` / job description (required) inputs to the cart panel or save dialog — these are NOT NULL in the DB
- Add optional project selector (`<Select>` populating from `/api/projects`)
- Replace the stub `onClick` handler with a real `POST /api/estimates` call:
  - Map cart items to line items: `{ category: item.itemType, item: item.description, quantity, unit: item.unitType, rate: item.retailPrice, total: quantity × retailPrice, priceBookItemId: item.id }`
  - `customId`: use same `generateCustomId()` pattern from `estimator.tsx`
  - `amount`: cart retail total as string
  - `status: "draft"`, `date`: today ISO string
- `queryClient.invalidateQueries({ queryKey: ["/api/estimates"] })` on success

### Step 3 — Contractor-calculator: add PDF export
- Import `jsPDF` (already installed: `import jsPDF from "jspdf"`)
- Add "Export PDF" button (enabled when cart has items and `clientName` is filled)
- Generate PDF:
  - Page header: company name (from `/api/company/mine`), "Estimate" label, estimate number, date
  - Client/prospect section: client name, job description, optional project name
  - Line items table: category | item | qty | unit | rate | total (use `pdf.text()` or `autoTable` plugin)
  - Totals section: labor subtotal, materials subtotal, grand total, margin
  - Footer: "This estimate is valid for 30 days" or similar
- `pdf.save(\`estimate-${clientName}-${date}.pdf\`)`

### Step 4 (optional) — Recent estimates panel on contractor-calculator
- Fetch `/api/estimates` and show recent saved estimates
- Allow clicking to load a saved estimate back into the cart for re-editing or re-exporting

### Step 5 (optional) — Notes field
- If notes persistence is required: add `notes: text("notes")` (nullable) to `estimates` table in `shared/schema.ts` and run `db:push`
- Pass `estimateNotes` from the save dialog through the API payload
