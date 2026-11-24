# N18 — Two simulated-operator authentication negative tests (24 November 2026)

**Scope:** Code-only tests within A-224 synthetic-only N18 implementation. No real Supabase identity, Neon login, real staff mapping or external access established.

These tests exercise the existing `requireCrmUser` function with a deliberately **mocked** upstream Supabase-authenticated session and deliberately **mocked** Neon internal-users query, not real credentials.

Cases:
1. A synthetic operator A session resolves only to synthetic CRM operator A.
2. A distinct synthetic viewer B session cannot inherit operator A's write role; B can view only.
3. Unknown users and inactive administrator records are refused.
4. Staff records with no `authSubject` cannot be claimed by a signed-in identity.
5. Missing upstream sessions and bad database-environment checks fail before querying staff.
6. No staff accounts are auto-created on a CRM read/login.

Limitations: This only tests **application authorization under mocked authentication**. No verified individual Alea/Anais Supabase users, personal Neon SQL principals, remotely invoked ChatGPT gateway, MFA assurance or revocation flow exists. The general Neon management connector still has owner SQL access and bypasses CRM route guards. Real account binding, SQL role/grant changes, deployment, durable real-data writes and email integration remain on hold pending C13, remaining N19 tests and separate approved activation.
