# N18 CRM Sandbox Foundation

This branch exists only for A-146 synthetic-data Sandbox implementation.

## Frozen branch base

`ecebccbab4f69c3d75099b92263843e2f94bfd1a`

The frozen base is not a Production approval, deployment approval, C2 completion or public-launch approval.

## Environment rules

- `local` and `sandbox` may connect only to the Neon Sandbox project.
- `production` is outside A-146 and must remain unconfigured during Sandbox Foundation work.
- The runtime uses one environment-neutral secret name: `CRM_DATABASE_URL`.
- `CRM_ENVIRONMENT` must be `local`, `sandbox` or `production`.
- A database-side `system_environment` marker must match the runtime before CRM operations proceed.
- No CRM database credential may use a `NEXT_PUBLIC_` variable.

## Current source-of-truth boundary

HubSpot remains HolyHub's live/durable CRM. This branch must not import or mutate live HubSpot, Gmail, Tally, subscriber or outreach state.

## Data rule

Sandbox fixtures must be synthetic. Use reserved/example domains and fictional records. Real HolyHub CRM/customer/lister/subscriber data is outside A-146.

## ChatGPT boundary

The CRM exposes named, bounded service operations. No generic SQL execution endpoint is permitted. Live write-capable ChatGPT CRM connector deployment is outside A-146; Sandbox Foundation tests only the HTTP/tool contract.
