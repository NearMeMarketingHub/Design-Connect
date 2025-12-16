# BuildVision - Project To-Do List

Last Updated: December 16, 2025

---

## ✅ Completed

### Authentication & User Management
- [x] Admin-side Budget Manager - CRUD operations for categories and line items
- [x] Excel Import - Imported 936 pricing items from Master Budget Template
- [x] Budget Manager UI - Accordions, search, and inline editing in Super Admin dashboard
- [x] Add `isApproved` field to users table for contractor approval workflow
- [x] Role-based portal login validation (Clients → Client Portal, Contractors → Contractor Portal, Admins → Any)
- [x] Block unapproved contractors with pending approval message
- [x] Admin approval UI - Pending contractors section with Approve/Reject buttons
- [x] Portal-based navigation - "Back to Dashboard" navigates based on login portal
- [x] Show/hide password toggles on all password fields

---

## 🔲 Pending

### Contractor Side

#### Budget Estimator
- [ ] Build contractor-facing calculator using admin-managed pricing data
- [ ] Allow contractors to select categories and enter quantities
- [ ] Auto-calculate totals from `budget_items` table
- [ ] Floor Calculator for room-based square footage calculations
- [ ] Generate estimate summaries that can be attached to projects

#### Contractor Dashboard & Features
- [ ] Contractor Dashboard page (currently "Coming Soon")
- [ ] Contractors Sandbox - testing environment for contractor features
- [ ] Progress Photos - build out post feature for uploading progress photos
- [ ] Plans and Drawings section for contractors

#### Document Upload from Contractor Side
- [ ] Ability to choose when uploading a document whether it needs to be signed or just documented in the system

---

### Client Side

#### Dashboard Connections (after contractor side is done)
- [ ] Action Required section - build out once contractor page is complete
- [ ] Stats Card - connect with data from contractor side
- [ ] Recent Updates Card - connect with data from contractor side

#### Documents Tab Reorganization
- [ ] Split documents tab into multiple tabs or sub-tabs:
  - Contracts
  - Plans and Drawings
  - Permits and Approvals
  - Invoices and Payments
  - Warranties and Manuals

#### Plans and Drawings
- [ ] Plans and Drawings section for clients

---

### Integrations

#### DocuSign
- [ ] Implement DocuSign for digital signatures

---

### Branding & Final Touches
- [ ] Change logo and app name when project is completed

---

## 📝 Notes

- Skip Sub List (Sheet 3) from Excel - only implement Labor_Budget and Floor Calculator
- Admin credentials: Username "Ciaadz697"
- Database has 936 budget items imported from Excel
- Client-side features depend on contractor-side data being completed first
