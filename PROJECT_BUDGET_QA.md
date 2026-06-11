# Project Budget — QA Checklist

Completed: Phase 11M  
Covers: Phases 11H · 11I · 11J · 11K · 11L + follow-up patch

---

## A. What Was Checked

### 1. Frontend tab visibility
| Role | Budget tab visible? | Write controls visible? |
|---|---|---|
| Platform admin | ✅ Yes | ✅ Yes |
| company_owner | ✅ Yes | ✅ Yes |
| Company admin (isCompanyAdmin) | ✅ Yes | ✅ Yes |
| Regular internal contractor (no contractorType, has companyId) | ✅ Yes | ❌ No (read-only) |
| Client | ❌ No | ❌ No |
| Subcontractor | ❌ No | ❌ No |
| Notary | ❌ No | ❌ No |
| Unauthenticated | ❌ No | ❌ No |

Source: `canViewBudget` / `canBudgetWrite` constants at `project-details.tsx:306-316`. Tab is wrapped in `{canViewBudget && ...}` at lines 3103 and 5597.

### 2. Backend route permissions
| Route | Auth | Clients blocked | Subs/Notaries blocked | Cross-company blocked | Body fields trusted for IDs? |
|---|---|---|---|---|---|
| GET /api/projects/:projectId/budget | requireAuth + requireEstimateAccess + requireActiveSubscription | ✅ | ✅ | ✅ (`resolveBudgetCompanyId` + defense-in-depth check) | N/A (read) |
| POST /api/projects/:projectId/budget | requireAuth + requireCompanyOwner + requireActiveSubscription | ✅ | ✅ (double-blocked) | ✅ | ❌ Never trusted |
| PATCH /api/projects/:projectId/budget | requireAuth + requireCompanyOwner + requireActiveSubscription | ✅ | ✅ (double-blocked) | ✅ | ❌ Never trusted |
| POST /api/projects/:projectId/budget/items | requireAuth + requireCompanyOwner + requireActiveSubscription | ✅ | ✅ (double-blocked) | ✅ | ❌ Never trusted |
| PATCH /api/projects/:projectId/budget/items/:itemId | requireAuth + requireCompanyOwner + requireActiveSubscription | ✅ | ✅ (double-blocked) | ✅ | ❌ Never trusted |
| DELETE /api/projects/:projectId/budget/items/:itemId | requireAuth + requireCompanyOwner + requireActiveSubscription | ✅ | ✅ (double-blocked) | ✅ | ❌ Never trusted |

Regular internal contractors pass `requireEstimateAccess` (GET) but fail `requireCompanyOwner` (write routes) — correct read-only behavior.

### 3. No-budget state
- Write user + project has estimates → estimate picker shown, approved sorted first ✅
- Write user + no project estimates → "No estimates available for this project yet." ✅
- Read-only user → message shown, no controls ✅
- Duplicate budget attempt → 409 "This project already has a budget." ✅ (both pre-flight check and DB unique constraint)

### 4. Create budget from estimate
- Only estimates linked to `projectId` appear in picker (client-side filter on `e.projectId === projectId`) ✅
- Backend validates `sourceEstimateId.projectId === req.params.projectId` → 400 if mismatch ✅
- Cross-company estimate rejected → 403 ✅
- Budget header + items created atomically in transaction ✅
- `project_budgets.totalEstimated` computed from line item totals ✅
- `projects.budget` synced in same transaction ✅
- Audit event `project_budget_created` fired ✅
- Budget query + project list + project detail queries all invalidated on success ✅

### 5. Budget display
- Summary card: title, status badge, Total Estimated, Total Actual, Variance ✅
- Variance: signed (`-$X.XX` red for negative, `$X.XX` green for positive) ✅
- Line items table: category, description, qty, unit, unit cost est., total est., notes ✅
- Zero items: "No budget items yet." + Add button for write users ✅
- No raw internal IDs visible in normal UI ✅

### 6. Budget editing (owner/admin)
- Edit Budget dialog: title, status (draft/active/locked), notes → PATCH route ✅
- Add Budget Item: category, description, qty, unit, unit cost, notes; `totalEstimated` auto-calculated and sent explicitly ✅
- Edit item: pre-filled form → PATCH item route ✅
- Delete item: in-app AlertDialog confirmation (no `window.confirm`) → DELETE route → 204 ✅
- After each mutation: `project_budgets.totalEstimated` recalculated ✅; `projects.budget` synced ✅; all 5 query keys invalidated ✅
- Audit events fired: `project_budget_updated`, `project_budget_item_created`, `project_budget_item_updated`, `project_budget_item_deleted` ✅

### 7. Audit Log display
| Event | Label | Color | Icon | All metadata keys labeled? |
|---|---|---|---|---|
| project_budget_created | Budget Created | teal | FileText | ✅ (projectId, budgetId, totalEstimated, status) |
| project_budget_updated | Budget Updated | teal | FileText | ✅ (projectId, budgetId, totalEstimated, oldStatus→newStatus) |
| project_budget_item_created | Budget Item Added | teal | FileText | ✅ (projectId, budgetId, category, itemDescription, totalEstimated) |
| project_budget_item_updated | Budget Item Updated | teal | FileText | ✅ (projectId, budgetId, category, itemDescription, totalEstimated) |
| project_budget_item_deleted | Budget Item Removed | teal | FileText | ✅ (projectId, budgetId, category, itemDescription, totalEstimated) |

### 8. Data sync
- `recalculateBudgetTotal` now updates both `project_budgets.totalEstimated` AND `projects.budget` (Phase 11L fix) ✅
- `createBudgetFromEstimate` syncs `projects.budget` in its own transaction ✅

### 9. Query invalidation (all 5 keys)
```
["/api/projects", projectId, "budget"]   — budget tab data
['/api/projects']                         — project list
[`/api/projects/${projectId}`]            — project detail (string form)
["/api/projects", projectId]              — project detail (array form)
["/api/admin/projects", projectId]        — admin project detail (partial prefix covers isFromAdmin variant)
```
Applied after: create from estimate, edit header, add item, edit item, delete item ✅

### 10. Error handling
- All mutations use `parseErrorMessage` in `onError` toast ✅
- Budget load error uses `parseErrorMessage` in destructive Alert ✅
- 409 duplicate budget: clean message surfaced via `parseErrorMessage` ✅
- "subscription" wording not used in any new user-facing copy ✅

---

## B. Issues Found

None. All checklist items passed code review.

---

## C. Fixes Made

No fixes were needed in this phase. Prior phases that resolved issues:

| Fix | Phase |
|---|---|
| `recalculateBudgetTotal` did not sync `projects.budget` | 11L |
| Budget tab only invalidated budget sub-query, not project list/detail | 11L + follow-up |
| Variance showed absolute value (lost minus sign) | 11K |
| Audit Log missing `projectId` and `category` labels | 11L |
| Unit Select "Other" option had broken fallback value | 11K |

---

## D. Items Deferred

| Item | Reason |
|---|---|
| Backend enforcement of `locked` status (block writes when status = locked) | Out of scope for Phase 11 — requires backend change, deferred to future hardening phase |
| Actual cost / expense entry (`unitCostActual`, `totalActual`) | Out of scope — planned for a later phase |
| Budget vs. actual reports | Out of scope |
| Price book item picker in budget item dialog | Out of scope |
| Budget versioning / history | Out of scope |
| Client-visible budget views | Out of scope by design |

---

## E. Visual Audit Checklist

Use the test accounts (`Test123!` for all) at `/auth`.

### E1 — Read-only contractor view
1. Log in as `testcontractor@buildvision.test` → Contractor portal
2. Open any project → click the **Budget** tab
3. **Expect:** Budget tab is visible. If no budget exists, you see "No project budget yet." with no controls. If a budget exists, you see the summary card and items table but **no** Edit Budget, Add Budget Item, or row Edit/Delete buttons.

### E2 — Owner write controls
1. Log in as `testcontractor@buildvision.test` (company_owner)
2. Open a project that has an approved estimate → **Budget** tab
3. **Expect:** Estimate picker appears. Select the estimate and click **Create Budget from Estimate**.
4. **Expect:** Success toast, budget summary card appears with title, status badge, Total Estimated, Total Actual ($0.00), Variance.

### E3 — Budget header edit
1. On the Budget tab (budget exists), click **Edit Budget**
2. Change the title and status to "Active", add a note → **Save Changes**
3. **Expect:** Success toast, summary card updates immediately with new title, status badge, and notes.

### E4 — Add budget item
1. Click **Add Budget Item**
2. Fill in: Category = "Electrical", Description = "Panel upgrade", Qty = 2, Unit = EA, Unit Cost = 500 → **Add Item**
3. **Expect:** Success toast, item row appears in table, Total Estimated increases by $1,000.00.

### E5 — Edit budget item
1. Click the pencil icon on any item row
2. Change the quantity → **Save Changes**
3. **Expect:** Success toast, row updates, Total Estimated recalculates.

### E6 — Delete budget item
1. Click the trash icon on any item row
2. **Expect:** In-app confirmation dialog appears (not a browser `confirm()`).
3. Click **Delete** → **Expect:** Success toast, row removed, Total Estimated recalculates.

### E7 — Variance display
1. While Total Actual is $0.00, verify Variance = Total Estimated (positive, green, upward arrow).
2. **Expect:** No minus sign on a positive variance.

### E8 — Permissions: client cannot see Budget tab
1. Log in as `testclient@buildvision.test` → Client portal → open a project
2. **Expect:** No Budget tab in the project navigation.

### E9 — Audit Log
1. Log in as `testadmin@buildvision.test` → `/admin-login`
2. Go to **Audit Log** → filter or scroll to find budget events
3. **Expect:** Budget Created / Budget Item Added / Budget Item Updated / Budget Item Removed rows with teal badges, readable metadata labels (Project ID, Budget ID, Category, Item Description, Total Estimated).

### E10 — No estimates available
1. Open a project that has no estimates linked to it → **Budget** tab (as owner/admin)
2. **Expect:** "No project budget yet." + "No estimates available for this project yet." message, no picker.
