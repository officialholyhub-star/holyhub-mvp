/**
 * N18 synthetic-only operator request boundary. No customer/mailbox input or
 * caller-provided actor/session fields may enter the bounded CRM service.
 * This validates the input shape, NOT the caller's identity.
 * Authentication/authorisation remains requireCrmUser on the server.
 */
export type CrmBoundedRequest = {
  operation: CrmMutationName;
  data: Record<string, unknown>;
};

const permittedFields = {
  saveOrganisation: ["id", "name", "domain", "category"],
  saveContact: ["id", "name", "organisationId", "jobTitle"],
  saveRoute: ["id", "contactId", "organisationId", "channel", "routeValue", "health"],
  transitionStage: ["relationshipId", "newStageId", "reason"],
  createAction: ["relationshipId", "actionType", "title", "dueAt"],
  completeAction: ["id"],
  applySafety: [
    "scopeType", "safetyType", "channel", "purpose", "reason", "sourceReference",
    "contactId", "organisationId", "contactRouteId", "routeValue", "organisationKey",
  ],
  clearSafety: ["id", "reason", "evidenceReference"],
  resolveReview: ["kind", "id", "reason"],
} as const;

export type CrmMutationName = keyof typeof permittedFields;

export class CrmRequestError extends Error {
  constructor(message = "Invalid bounded CRM operation.") {
    super(message);
    this.name = "CrmRequestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseCrmBoundedRequest(body: unknown): CrmBoundedRequest {
  if (!isRecord(body)) throw new CrmRequestError();
  if (Object.keys(body).some((key) => key !== "operation" && key !== "data")) {
    throw new CrmRequestError("Unrecognised CRM request field.");
  }
  const { operation, data } = body;
  if (typeof operation !== "string" || !Object.prototype.hasOwnProperty.call(permittedFields, operation)) {
    throw new CrmRequestError("This CRM operation is not permitted.");
  }
  if (!isRecord(data)) throw new CrmRequestError("CRM data must be an object.");
  const allowed = permittedFields[operation as CrmMutationName] as readonly string[];
  if (Object.keys(data).some((key) => !allowed.includes(key))) {
    throw new CrmRequestError("Unrecognised CRM data field.");
  }
  return { operation: operation as CrmMutationName, data };
}
