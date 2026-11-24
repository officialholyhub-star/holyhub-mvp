# N18 — Synthetic record-target guards (24 November 2026)

**Authority:** A-224, Anais's already approved bounded synthetic-only sandbox API fixes. No approval is inferred for real staff credentials, schema migrations, a deployment, or live contacts.

## What changed
The existing N18 operator API previously validated *new* fictional values but could target an already existing non-fictional row by UUID. Before updating existing organisations, contacts and routes, it now re-verifies that the stored target is fictional. Other synthetic mutations validate linked organisations, relationships, contact/route owners, existing actions and safety controls. Stage transitions and action completion validate fictional ownership **inside the same transaction** as the write. Existing two synthetic fixture organisations use `source_confidence` values `verified` and `corroborated`, so that field is **not** used as a fictional-data flag; reserved fictional names/domains and synthetic origin markers are used instead.

The changes preserve the existing fixed CRUD operation list, Supabase session check on the API route, audit/activity writes, admin-only clearance and the `CRM_ENVIRONMENT`/Neon sandbox environment check. No Gmail/Tally/HubSpot events or outbound messages are triggered. Dedicated regression tests are included.

## Still not sufficient for real CRM
- These are **application-level synthetic-target checks**, not a guaranteed classification of whether a person or brand is real; deceptive fictional-looking values remain a risk. Real data never belongs in this sandbox.
- The existing broad Neon MCP SQL connection **bypasses** these TypeScript checks. A future secure path must strip arbitrary SQL/DML permissions, verify the human at the connector boundary, derive actor identity server-side, and enforce atomic audit with no bypass.
- The Neon project currently exposes only one administrative member and no real staff mappings. A selected SQL role is not, without further proof, a cryptographically authenticated Alea/Anais principal.
- ChatGPT custom MCP *write* connections may be plan-restricted. OpenAI's current help documentation lists full custom MCP with writes for Business/Enterprise/Edu and Pro custom MCP read/fetch only. Verify actual user's plan and product path before commissioning any remote MCP hosting or upgrade; none is authorised.
- N19's cross-chat marker-preservation test passed, but the separate stale-write conflict/handover tests remain unproven. Alea-owned C13 CRM staff/MFA/access/recovery/privacy checks are still open.
- GATE-007 CRM cutover is not approved; HubSpot remains canonical; full real-data and email sends remain held.
