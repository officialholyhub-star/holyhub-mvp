# N18 Approval 2A — synthetic operator build (22 Nov 2026)

Authority: Anais's explicit 2A approval under A-222. No additional authority for live data, credentials, real-user bindings, integration, deployments, sends or cutover.

## Built
- Seven operator areas in `app/admin/crm/console.tsx` and the bounded `/api/crm/operate` endpoint.
- CRUD for fictional organisations, contacts and contact routes; stage transitions, follow-ups, audited Needs Review resolutions.
- Retained independent safety route/domain identifiers, active-control uniqueness, audit/evidence, contact/route/organisation/subscriber FKs with SET NULL, and fail-closed assessments.
- Sandbox-only input restrictions: fictional names and reserved .example/.test/.invalid email/domain data or fictional phone numbers.
- Active route-health failures create durable holds. Marking a route healthy never clears active safety records.
- Operators can add controls; administrators alone can clear after documented synthetic evidence. Clearance retains the control and audit trail.
- Read-only viewers cannot POST. No generic SQL API, sending path, live inbox connection or actual operator account binding.

## Database application and migration caution
Migration `db/crm/migrations/0001_n18_safety_retention.sql` was prepared and deletion-tested on a Neon temporary branch, then explicitly applied to the existing `holyhub-crm-sandbox` default branch via the Neon migration tool under 2A. It does not contain real HolyHub data.

The original A-146 sandbox foundation was bootstrapped outside Drizzle and currently has **no `drizzle.__drizzle_migrations` tracker**. The migration journal/snapshot are version-controlled for future fresh installs. **Do not run `npm run crm:migrate` against the already-bootstrapped sandbox without a separate safe baseline-tracker reconciliation.** A migration can be re-run only after independently verifying the target and current schema. No credentials or deployment setup is included in 2A.

## Tests and limitations
CI executes Node tests, ESLint, Next.js build and Drizzle generation. A Neon sandbox transaction test with the restricted API runtime created fictional records/objection/failed route, confirmed duplicate control prevention and ON DELETE SET NULL survival, then rolled back test data.

No real-person sessions, live browser deployment, or external integrations were authorised. Operator UI/APIs are code-ready but cannot be used by a real staff account until separately approved real-user identity binding, secret-store setup and C13/N19 gates. HubSpot remains live source of truth; no outreach eligibility or send is authorised.

For later production/real data phases re-validate legal classifications, UK GDPR/PECR, C13/N19, and N14 safety handoff, before any migration, live activation, outreach or GATE-007 CRM cutover.
