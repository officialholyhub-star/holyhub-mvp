# N18 — No alternate action-write bypass; atomic synthetic action audit (24 November 2026)

**Active human:** Anais. **Authority:** A-224 controlled synthetic-only API fixes. **Scope:** isolated `anais/n18-crm-sandbox` code and tests only; no real contacts, mail, SQL schema/grants, credentials, deployment, or staff binding.

## Finding
A second action endpoint, `POST /api/crm/actions`, still used the original `createCrmAction` service directly, without the stricter `runOperatorMutation` sandbox requirements. It accepted arbitrary action types/titles/relationship UUIDs and did not require fictional targets. It also wrote an Activity entry but not a Field Change Audit entry when creating an action.

## Fix
The legacy action endpoint now delegates to the **same authenticated and bounded sandbox operator** as `POST /api/crm/operate`:
- `requireCrmUser(["crm_admin","crm_operator"])` for a previously authenticated active CRM user; actor ID derives from the server's CRM user, never request text.
- `parseCrmBoundedRequest` accepts only `createAction` and its known fields for the legacy request shape.
- `runOperatorMutation` rejects non-fictional action titles and non-fictional relationship targets; its deduplication lock prevents duplicate open actions on retry.
- Creation now writes **both** a Field Change Audit row and Activity row inside `withTx` before COMMIT. If either write throws, the transaction rolls back. This is an **application-level atomicity property for this route**, not a database-wide immutable audit enforcement: raw Neon SQL remains a bypass.

The existing compatibility response still returns `{ok:true,action}` and HTTP 201 for a new action, or 200 for a replay. No external send is possible through this endpoint.

## Non-goals / holds
The currently installed Neon administrator connection can select owner or write-enabled Postgres roles; it is not per-human authenticated, and no real CRM staff mapping exists. N19 live two-chat marker preservation passed, but simultaneous conflict/handover and C13 CRM staff privacy/MFA/recovery remain open. Do not bind actual Alea/Anais accounts, add a Neon role or grant, configure OAuth secrets, deploy Netlify, import real data, schedule/send mail or change HubSpot's canonical status under this patch.

This guard closes **one concrete API bypass**; it does not by itself satisfy the full per-user gateway, audit-immunity or cutover gate.
