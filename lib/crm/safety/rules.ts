export type SafetyMatch = {
  status: string;
  scopeType: string;
  safetyType: string;
  channel: string | null;
  purpose: string | null;
  routeNormalisedValue: string | null;
  organisationKey: string | null;
  organisationId: string | null;
  contactId: string | null;
};
export type EligibilityIdentity = {
  channel: string;
  routeValue?: string | null;
  organisationKey?: string | null;
  organisationId?: string | null;
  contactId?: string | null;
  purpose: string;
};

export function normaliseRoute(channel: string, value: string): string {
  const raw = value.trim();
  if (channel === "email") {
    const normal = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normal) || normal.length > 240) throw new Error("Valid email route required.");
    return normal;
  }
  if (channel === "phone" || channel === "whatsapp") {
    const normal = raw.replace(/[\s().-]/g, "");
    if (!/^\+[1-9][0-9]{7,14}$/.test(normal)) throw new Error("International phone route required.");
    return normal;
  }
  throw new Error("Unsupported contact channel.");
}

export function isFictionalRoute(channel: string, normalisedValue: string): boolean {
  if (channel === "email") return /@(?:[a-z0-9-]+\.)*(?:example|test|invalid)$/i.test(normalisedValue);
  return /^\+1[0-9]{3}55501[0-9]{2}$/.test(normalisedValue);
}

export function isFictionalOrganisation(name: string, domain?: string | null): boolean {
  return /^(example|synthetic|test)(?:\s|\s*[-:])/i.test(name.trim()) &&
    (!domain || /(?:^|\.)(?:example|test|invalid)$/i.test(domain.trim()));
}

export function matchesActiveSafety(record: SafetyMatch, identity: EligibilityIdentity): boolean {
  if (record.status !== "active") return false;
  if (record.channel && record.channel !== identity.channel) return false;
  if (record.purpose && record.purpose !== "all" && record.purpose !== identity.purpose &&
      !(identity.purpose === "marketing" && record.purpose === "outreach")) return false;
  if (record.scopeType === "organisation") {
    return Boolean((record.organisationId && record.organisationId === identity.organisationId) ||
      (record.organisationKey && record.organisationKey === identity.organisationKey?.trim().toLowerCase()));
  }
  if (record.scopeType === "contact" && record.contactId && record.contactId === identity.contactId) return true;
  const route = identity.routeValue ? normaliseRoute(identity.channel, identity.routeValue) : null;
  return Boolean(route && record.routeNormalisedValue === route);
}

export function assessSyntheticEligibility(identity: EligibilityIdentity, controls: SafetyMatch[]) {
  if (!identity.routeValue || !identity.channel || !identity.purpose) {
    return { allowed: false, safetyBlocked: false, reasons: ["unknown_contact_route", "sandbox_no_delivery"] };
  }
  let normal: string;
  try { normal = normaliseRoute(identity.channel, identity.routeValue); }
  catch { return { allowed: false, safetyBlocked: false, reasons: ["invalid_contact_route", "sandbox_no_delivery"] }; }
  const active = controls.filter(record => matchesActiveSafety(record, {...identity, routeValue: normal}));
  return {
    allowed: false,
    safetyBlocked: active.length > 0,
    reasons: [...new Set([...active.map(record => record.safetyType), "lawful_route_not_verified", "sandbox_no_delivery"])],
  };
}
