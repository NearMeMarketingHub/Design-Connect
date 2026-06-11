# BuildVision — Test Accounts

All test accounts use the password: `Test123!`

## Quick Reference

| Username | Email | Password | Role | Login Portal | Notes |
|---|---|---|---|---|---|
| `testadmin` | testadmin@buildvision.test | Test123! | Admin | `/admin-login` | Full admin dashboard; approve contractors, manage platform |
| `testcontractor` | testcontractor@buildvision.test | Test123! | Company Owner | `/auth` → Company tab | Owns a company with multiple projects (Jenkins Residence, Lake House, etc.) |
| `testcompanyadmin` | testcompanyadmin@buildvision.test | Test123! | Company Admin | `/auth` → Company tab | Same company as testcontractor; elevated write access, no ownership privileges |
| `testteammember` | testteammember@buildvision.test | Test123! | Team Member | `/auth` → Company tab | Same company as testcontractor; read-only on budget/estimates, no write controls |
| `testnotary` | notary@test.com | Test123! | Notary | `/auth` → Sub/Notary tab | Assigned to testcontractor's projects; uses notary portal |
| `testsubcontractor` | testsubcontractor@buildvision.test | Test123! | Subcontractor | `/auth` → Sub/Notary tab | Assigned to The Jenkins Residence with default read permissions |
| `testclient` | testclient@buildvision.test | Test123! | Client | `/auth` → Client tab | Client-side portal with project tracking and messaging |

## Portal URLs

| Portal | URL |
|---|---|
| Admin | `/admin-login` |
| Company (owners, admins, employees) | `/auth` — select the **Company** tab |
| Sub / Notary hub | `/auth` — select the **Sub / Notary** tab |
| Client | `/auth` — select the **Client** tab |

## Per-Account Details

### testadmin
- **Role**: `admin`
- **Access**: Full platform admin dashboard — approve/reject contractor registrations, view all companies, manage platform settings

### testcontractor
- **Role**: `company_owner`
- **Company**: BuildVision test company
- **Projects**: The Jenkins Residence, Lake House Retreat, Downtown Loft, Miller Kitchen, and others
- **Access**: Full company portal — projects, estimates, invoices, team management, change orders, e-signatures

### testcompanyadmin
- **Role**: `contractor` / `isCompanyAdmin: true`
- **Company**: Same as testcontractor
- **Access**: Company portal — same project/estimate/budget write access as the owner, but cannot transfer company ownership or manage billing
- **Use for**: Testing company-admin-level editing controls (Edit Budget, add items, change orders, etc.)

### testteammember
- **Role**: `contractor` / `isCompanyAdmin: false` / no contractorType
- **Company**: Same as testcontractor
- **Access**: Company portal — can view all company projects, estimates, messages; read-only on budget items; no write or delete controls
- **Use for**: Testing the read-only view that regular employees see (no Edit/Delete buttons, no create forms)

### testnotary
- **Role**: `contractor` / `contractorType: notary`
- **Access**: Sub/Notary hub — assigned projects only; notary portal for document work
- **Default permissions on assigned projects**: View Docs, Upload Docs, View Messages

### testsubcontractor
- **Role**: `contractor` / `contractorType: subcontractor`
- **Assigned project**: The Jenkins Residence (testcontractor's company)
- **Default permissions**: View Docs, View Messages (read-only; no budget or estimate access by default)

### testclient
- **Role**: `client`
- **Access**: Client portal — project progress, inspiration board, messaging, invoices

## Changing Passwords

To update a test account password, log in as that user and use the profile settings, or ask the platform admin (`testadmin`) to reset it.
