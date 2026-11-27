import { matchesActiveSafety, normaliseRoute, isFictionalRoute, type SafetyMatch } from "./rules";

/** A-180/A-218 synthetic preflight only. No send authority, DB write or external integration. */
export type EvidenceCheck = "clear" | "blocked" | "unknown";
export type OutreachFixture = {
  route: string;
  organisationKey?: string;
  organisationId?: string;
  contactId?: string;
  jurisdiction: "UK" | "international" | "unknown";
  subscriber: "corporate" | "individual" | "unknown";
  classificationEvidence: string;
  legalRoute: "corporate_b2b" | "consent" | "soft_opt_in" | "unknown";
  legalEvidence: string;
  privacyAndOptOut: EvidenceCheck;
  suppressionCoverage: EvidenceCheck;
  gmailHistory: EvidenceCheck;
  crmHistory: EvidenceCheck;
  tallyHistory: EvidenceCheck;
  duplicateCheck: EvidenceCheck;
  routeHealth: EvidenceCheck;
  templateApproval: EvidenceCheck;
};
const checks = ["privacyAndOptOut","suppressionCoverage","gmailHistory","crmHistory","tallyHistory","duplicateCheck","routeHealth","templateApproval"] as const;
export function assessOutreachFixture(fixture: OutreachFixture, controls: SafetyMatch[]) {
  const reasons: string[] = [];
  let route: string;
  try { route = normaliseRoute("email",fixture.route); }
  catch { return { screening: "HOLD", reasons: ["invalid_route"], sendAllowed: false } as const; }
  if (!isFictionalRoute("email",route)) return { screening: "HOLD", reasons: ["non_fictional_route"], sendAllowed: false } as const;
  if (!fixture.organisationKey?.trim() && !fixture.organisationId && !fixture.contactId) reasons.push("identity_unresolved");
  if (fixture.jurisdiction !== "UK") reasons.push("jurisdiction_requires_review");
  if (!["corporate","individual"].includes(fixture.subscriber) || !fixture.classificationEvidence?.trim()) reasons.push("subscriber_unverified");
  const acceptedRoute = fixture.subscriber === "corporate"
    ? ["corporate_b2b","consent","soft_opt_in"].includes(fixture.legalRoute)
    : fixture.subscriber === "individual" && ["consent","soft_opt_in"].includes(fixture.legalRoute);
  if (!acceptedRoute || !fixture.legalEvidence?.trim()) reasons.push("lawful_route_unverified");
  for (const check of checks) if (fixture[check] !== "clear") reasons.push(check+"_"+(fixture[check]==="blocked"?"blocked":"unverified"));
  if (!Array.isArray(controls)) reasons.push("safety_controls_unavailable");
  else for (const control of controls) {
    if (matchesActiveSafety(control,{channel:"email",purpose:"marketing",routeValue:route,
      organisationKey:fixture.organisationKey,organisationId:fixture.organisationId,contactId:fixture.contactId})) reasons.push(control.safetyType);
  }
  return { screening: reasons.length ? "HOLD" : "SYNTHETIC_SCREEN_PASS", reasons: [...new Set(reasons)], sendAllowed: false } as const;
}
