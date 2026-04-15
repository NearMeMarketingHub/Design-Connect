# BuildVision - Client & Contractor Portal

## Overview

BuildVision is a collaborative construction management platform that connects contractors with clients. It provides project tracking, inspiration boards, estimating tools, invoicing, and real-time communication for construction and renovation projects.

The application follows a full-stack TypeScript architecture with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend uses a role-based dashboard system with separate views for clients and contractors/admin users. Key UI patterns include:
- Responsive sidebar navigation that adapts to user role
- Card-based layouts for project and financial data
- Tabbed interfaces for complex pages like project details

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with local strategy and express-session
- **Session Storage**: connect-pg-simple for PostgreSQL-backed sessions

API routes follow RESTful conventions under `/api` prefix. The server handles:
- User authentication (register, login, logout, session management)
- CRUD operations for projects, estimates, invoices, and related entities
- File-based static serving in production

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` - contains all table definitions
- **Migrations**: Drizzle Kit with `db:push` command for schema sync

Key data models include:
- Users (clients and contractors with role-based access)
- Projects (with phases, progress tracking, budgets)
- Estimates and line items
- Invoices with recurring billing support
- Inspiration images and messaging
- E-Signature system (signing packets, participants, audit events)
- Change orders with line items (for scope/budget/timeline changes)
- Project team members with per-project permissions JSON (for sub/notary access control)

### Change Order System
BuildVision includes a comprehensive change order management system:
- **Change Order Creation**: Contractors create change orders with title, description, reason, cost impact, and timeline impact
- **Line Items**: Detailed breakdown with quantity, unit (EA, SF, LF, HR, LS), rate, and calculated amount
- **Status Workflow**: pending → approved/rejected
- **Client Approval**: Clients can review pending change orders and approve or reject with reason
- **Auto-Update**: Approved change orders automatically update project budget and extend due date based on timeline impact
- **E-Signature Integration**: "Send for Signature" button on approved change orders (requires PDF generation enhancement for full functionality)
- **Sequential Numbering**: CO-001, CO-002, etc. per project

### E-Signature System
BuildVision includes an in-app document e-signature system compliant with ESIGN/UETA requirements:
- **Signing Packets**: Group documents with recipients, due dates, and custom messages
- **Secure Token System**: SHA-256 hashed tokens stored in database; raw tokens sent only via email
- **Signature Options**: Draw signatures on canvas or type name with 4 font styles (Dancing Script, Great Vibes, Pacifico, Allura)
- **Audit Trail**: Comprehensive event logging (created, sent, viewed, signed, completed) with timestamps, IP addresses, user agents
- **Email Notifications**: Signature requests sent via Resend integration with professional templates
- **Public Signing Page**: Token-based access at `/sign/:token` for external recipients

### Company-Based Architecture
BuildVision uses a company-based multi-tenant model:
- **Company Owner** (`role='company_owner'`): Registers as a plain contractor, auto-creates a company. Has full dual dashboard (contractor + company management). Sees all company projects.
- **Contractor** (`role='contractor'`, no contractorType): Regular employee of a company. Sees all company projects. Can edit project data.
- **Notary** (`role='contractor'`, `contractorType='notary'`): Requires admin approval. Has notary portal at `/notary/portal`. Uses Sub/Notary hub at `/subcontractor/dashboard`. Only sees explicitly assigned projects.
- **Subcontractor** (`role='contractor'`, `contractorType='subcontractor'`): Spans multiple companies via email invite. Only sees explicitly assigned projects. Read-only on project details.
- **Role Definitions**: Platform admins create role templates with permission sets. Company owners can assign templates to team members.
- **Company isolation**: All data (projects, team, financials) is scoped to companyId. `app.param("projectId")` enforces access checks on all project-scoped routes.
- **Startup migration**: `server/migrate-roles.ts` runs idempotently on startup to promote legacy contractor accounts to company_owner.

### Sub-Contractor / Notary Hub
Unified project hub for external workers (subcontractors and notaries):
- **Dashboard**: `/subcontractor/dashboard` — shows stats (active, companies, completed), project cards with permission chips, access legend, profile card
- **Dedicated Sidebar**: Simplified nav (Dashboard, My Assignments, Notary Portal for notaries) vs full contractor sidebar for company users
- **Per-Project Permissions**: JSON column on `projectTeamMembers` table with keys: `canViewDocuments`, `canUploadDocuments`, `canViewBudget`, `canViewMessages`, `canPostMessages`, `canViewEstimates`
- **API**: `GET /api/my-projects` — returns all assigned projects with companyName, permissions, membershipId
- **Invite External**: Company owners/admins can invite subs/notaries via email from the project team card (`POST /api/projects/:id/invite-external`). If user exists → added directly; if not → creates a 7-day pending ContractorInvite
- **Permissions Update**: `PATCH /api/projects/:id/team/:memberId/permissions` — company owners/admins can update per-project permissions

### Authentication & Authorization
- Session-based authentication with 30-day cookie expiration
- Password hashing with bcryptjs
- Role-based access control (client vs contractor/admin views)
- Protected API routes that return user context
- Portal-based login validation:
  - Clients can only log in through Client Portal
  - Contractors can only log in through Contractor Portal
  - Admins can access any portal
- Contractor approval workflow:
  - New contractors register with `isApproved: false`
  - Contractors cannot log in until approved by admin
  - Super Admin dashboard shows pending contractors for approval/rejection
- Portal context tracking in auth-context for navigation (stored in sessionStorage)

### Build & Development
- Development: Vite dev server with HMR proxied through Express
- Production: esbuild bundles server code, Vite builds client assets
- Both client and server share TypeScript types from `shared/` directory

## External Dependencies

### Database
- PostgreSQL database (required, connection via `DATABASE_URL` environment variable)
- Session table auto-created by connect-pg-simple

### Third-Party Libraries
- **UI Components**: Radix UI primitives (dialogs, menus, forms, etc.)
- **Charts**: Recharts for data visualization
- **Date Handling**: date-fns
- **Form Validation**: Zod with drizzle-zod integration
- **Signature Capture**: react-signature-canvas (for contract signing)

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption (has fallback for development)

### Replit-Specific Integrations
- Custom Vite plugins for development banner and error overlays
- Meta image plugin for OpenGraph/Twitter card images
- Cartographer plugin for code navigation

## Test Accounts

See `TESTACCOUNTS.md` in the project root for the complete list of test accounts, emails, passwords, roles, and portal URLs. Quick summary:

| Username | Email | Role | Portal |
|---|---|---|---|
| `testadmin` | testadmin@buildvision.test | Admin | /admin-login |
| `testcontractor` | testcontractor@buildvision.test | Company Owner | /auth → Company tab |
| `testnotary` | notary@test.com | Notary | /auth → Sub/Notary tab |
| `testsubcontractor` | testsubcontractor@buildvision.test | Subcontractor | /auth → Sub/Notary tab |
| `testclient` | testclient@buildvision.test | Client | /auth → Client tab |

All test accounts use password: `Test123!`

## Future Tasks

See `TODO.md` in the project root for the complete, up-to-date task list.