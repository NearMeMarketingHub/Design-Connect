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

### Admin Side
- [ ] Contractors Sandbox

### Contractor Side
- [x] Build contractor-facing calculator using admin-managed pricing data
- [ ] Floor Calculator for room-based square footage calculations
- [ ] Generate estimate summaries that can be attached to projects
- [x] Building out the post feature for the progress photos on the contractors side of the app
- [ ] Plans and Drawings section for Contractor
- [ ] The ability to choose when uploading a document from the contractor side, whether it needs to be signed or its just being uploaded to have documented in the system
- [ ] Project-type-specific default milestones - Different preset milestones based on Project Type (Renovation, Remodel, Addition, Commercial, Residential) selected during project creation. Waiting on milestone data.

### Client Side
- [ ] Action required section in the client side to be built out once contractor page is done
- [ ] Stats card in the client page to connect with data completed in the contractor side
- [ ] Recent Updates card in the client page to connect with data completed in the contractor side
- [ ] Splitting up the documents tab in the client side to either have multiple tabs, or multiple tabs within the document tabs for Contracts, Plans and Drawings, Permits and Approvals, Invoices and Payments, and Warranties and Manuals
- [ ] Plans and Drawings section for Client

### Integrations
- [ ] Implementing Docusign

### Branding
- [ ] Changing the logo and app name when completed

---

## 📝 Notes

- Skip Sub List (Sheet 3) from Excel - only implement Labor_Budget and Floor Calculator
- Admin credentials: Username "Ciaadz697"
- Database has 936 budget items imported from Excel
