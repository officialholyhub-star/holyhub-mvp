export type CrmToolContract = {
  name: string;
  description: string;
  mode: "read" | "write";
  implementedInSandbox: boolean;
  inputSchema: Record<string, unknown>;
};

export const crmToolContracts: CrmToolContract[] = [
  {
    name: "crm_get_dashboard",
    description: "Return current CRM workload and system-health counts for the authenticated internal user.",
    mode: "read",
    implementedInSandbox: true,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "crm_create_action",
    description: "Create one bounded CRM action for an existing relationship and record matching Activity evidence.",
    mode: "write",
    implementedInSandbox: true,
    inputSchema: {
      type: "object",
      required: ["relationshipId", "actionType", "title"],
      properties: {
        relationshipId: { type: "string", format: "uuid" },
        actionType: { type: "string" },
        title: { type: "string", minLength: 1, maxLength: 240 },
        dueAt: { type: ["string", "null"], format: "date-time" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "crm_transition_stage",
    description: "Move one relationship to a valid stage in its configured pipeline and append stage/audit history.",
    mode: "write",
    implementedInSandbox: true,
    inputSchema: {
      type: "object",
      required: ["relationshipId", "newStageId"],
      properties: {
        relationshipId: { type: "string", format: "uuid" },
        newStageId: { type: "string", format: "uuid" },
        reason: { type: ["string", "null"], maxLength: 500 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "crm_search_relationships",
    description: "Search canonical relationships through a bounded query operation.",
    mode: "read",
    implementedInSandbox: false,
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 200 } }, additionalProperties: false },
  },
  {
    name: "crm_apply_safety_control",
    description: "Apply a scoped contact-safety control after explicit validation and audit checks.",
    mode: "write",
    implementedInSandbox: false,
    inputSchema: { type: "object", additionalProperties: false },
  },
];
