# BuildVision - Project To-Do List

Last Updated: January 9, 2026

---

## ✅ Completed

### Change Order System
- [x] Database schema for change orders with line items (orderNumber, title, description, reason, costImpact, timelineImpact, status)
- [x] API endpoints for CRUD operations, approval/rejection workflow
- [x] Contractor UI to create, edit, delete change orders with line item breakdown
- [x] Client UI to view and approve/reject change orders
- [x] Auto-update project budget and timeline on approval
- [x] "Send for Signature" button on approved change orders (partial - see enhancement note)

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
- [x] Floor Calculator for room-based square footage calculations
- [ ] Generate estimate summaries that can be attached to projects
- [x] Building out the post feature for the progress photos on the contractors side of the app
- [ ] Plans and Drawings section for Contractor
- [ ] Project-type-specific default milestones - Different preset milestones based on Project Type (Renovation, Remodel, Addition, Commercial, Residential) selected during project creation. Waiting on milestone data.
- [ ] Template-based timeline system - Each project type has predefined milestone durations (in days). When a project is created with a due date and project type, the system calculates actual dates for each milestone by working backwards from the due date. Duration templates would specify things like "Demolition = 3 days, Plumbing = 5 days, Tile = 4 days" and convert these into calendar dates.

### Contractor Internal Roles (Company Type Access Levels)
Base role structure created in `shared/contractor-roles.ts`. Implementation pending.

**Role Types:**
- Project Manager (internal staff with full access)
- Lead Designer
- Electrician
- Plumber
- HVAC Technician
- Carpenter
- Roofer
- Painter
- Flooring Specialist
- Mason
- Landscaper
- Other

**Access Limitations to Implement:**
- [ ] Define which features each company type can access
- [ ] Restrict project creation to General Contractor and Project Manager roles
- [ ] Restrict team management to General Contractor and Project Manager roles
- [ ] Restrict Budget Manager access to General Contractor only
- [ ] Restrict invoicing access based on role
- [ ] Trade specialists (Electrician, Plumber, HVAC, etc.) - view only assigned projects
- [ ] UI element hiding based on company type permissions
- [ ] Route protection by company type
- [ ] Sidebar navigation filtering based on permissions

### Client Side
- [ ] Action required section in the client side to be built out once contractor page is done
- [ ] Stats card in the client page to connect with data completed in the contractor side
- [ ] Recent Updates card in the client page to connect with data completed in the contractor side
- [ ] Splitting up the documents tab in the client side to either have multiple tabs, or multiple tabs within the document tabs for Contracts, Plans and Drawings, Permits and Approvals, Invoices and Payments, and Warranties and Manuals
- [ ] Plans and Drawings section for Client

### Real-Time Chat Support System
- [ ] Integrate WebSocket-based real-time messaging for instant communication
- [ ] Add support chat widget accessible from all pages for immediate assistance
- [ ] Implement typing indicators and online/offline status
- [ ] Add push notifications for new messages
- [ ] Create admin support dashboard for managing support conversations
- [ ] Add chat history and search functionality

### Email Configuration
- [ ] Configure different sender email addresses per application using Resend integration - allows each app to send from its own branded email address while sharing the same Resend API key

### Spanish Translation (Hybrid System)
**Prerequisites:** OpenAI API key (managed at platform.openai.com, separate from ChatGPT subscription)

**Full UI Translation (i18n):**
- [ ] Add language toggle in user settings (English/Spanish)
- [ ] Create translation files with all UI text in both languages
- [ ] Implement React context for language state management
- [ ] Create reusable `t()` function for translating static UI text
- [ ] Update all components to use translation keys instead of hardcoded text

**Auto-Translation for User Content:**
- [ ] Create translation API endpoint using OpenAI
- [ ] Implement bidirectional translation based on user's language preference
- [ ] English users see Spanish content translated to English
- [ ] Spanish users see English content translated to Spanish
- [ ] Apply to messages, notes, and other user-generated content

**Future Features:**
- New UI text needs to be added to translation files as features are built
- Auto-translation works automatically for any new user content fields

### Change Order E-Signature Enhancement
- [ ] Generate PDF documents from approved change orders for full e-signature integration
- [ ] Currently the "Send for Signature" button opens the signature dialog with change order title pre-filled, but signers need a document to view and sign
- [ ] Options: Generate PDF server-side or create inline change order content display in signing page

### Branding
- [ ] Changing the logo and app name when completed

---

## 📝 Notes

- Skip Sub List (Sheet 3) from Excel - only implement Labor_Budget and Floor Calculator
- Admin credentials: Username "Ciaadz697"
- Database has 936 budget items imported from Excel
