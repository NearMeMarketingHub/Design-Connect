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

### Authentication & Authorization
- Session-based authentication with 30-day cookie expiration
- Password hashing with bcryptjs
- Role-based access control (client vs contractor/admin views)
- Protected API routes that return user context

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