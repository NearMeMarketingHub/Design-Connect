---
name: Passport 0.6+ session regeneration
description: req.logIn() regenerates the session by default in Passport 0.6+, destroying custom session properties unless keepSessionInfo is passed.
---

# Passport 0.6+ session regeneration

**Rule:** Always pass `{ keepSessionInfo: true }` to `req.logIn()` when you need to preserve existing session properties (e.g. `req.session.adminData`).

**Why:** Passport 0.6 introduced a security change where `req.logIn()` calls `session.regenerate()` by default, which creates a new session ID and clears all non-Passport session properties. This broke the View As User feature where `adminData` was set before `req.logIn(target)` — the data was lost on the new session.

**How to apply:** Whenever swapping Passport's logged-in user mid-session (e.g. impersonation, view-as, sudo modes), pass the option:
```typescript
req.logIn(user, { keepSessionInfo: true }, (err) => { ... });
```
Project version: `"passport": "^0.7.0"` (0.6+ behavior applies).
