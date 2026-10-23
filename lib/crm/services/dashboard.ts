import "server-only";

import { assertCrmDatabaseEnvironment, getCrmPool } from "@/lib/crm/db/client";

export type CrmDashboardCounts = {
  needsReply: number;
  followUpsDue: number;
  overdue: number;
  newApplications: number;
  applicationsAwaitingReview: number;
  newSubscribers: number;
  callsDue: number;
  needsReview: number;
  safetyIssues: number;
  failedAutomations: number;
};

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number.parseInt(value, 10) || 0;
  return 0;
}

export async function getCrmDashboardCounts(): Promise<CrmDashboardCounts> {
  await assertCrmDatabaseEnvironment();
  const result = await getCrmPool().query(`
    select
      (select count(*) from crm.actions where status = 'open' and action_type = 'reply') as needs_reply,
      (select count(*) from crm.actions where status = 'open' and action_type = 'follow_up' and due_at <= now()) as follow_ups_due,
      (select count(*) from crm.actions where status = 'open' and due_at < now()) as overdue,
      (select count(*) from crm.applications where submitted_at >= now() - interval '7 days') as new_applications,
      (select count(*) from crm.applications where status in ('submitted', 'under_review')) as applications_awaiting_review,
      (select count(*) from crm.subscribers where status = 'active' and created_at >= now() - interval '7 days') as new_subscribers,
      (select count(*) from crm.actions where status = 'open' and action_type = 'call' and (due_at is null or due_at <= now())) as calls_due,
      ((select count(*) from crm.actions where status = 'open' and action_type = 'needs_review') +
       (select count(*) from crm_ops.integration_events where status = 'needs_review')) as needs_review,
      (select count(*) from crm.safety where status = 'active') as safety_issues,
      (select count(*) from crm_ops.automations where health in ('degraded', 'failed', 'needs_review')) as failed_automations
  `);

  const row = (result.rows[0] ?? {}) as Record<string, unknown>;
  return {
    needsReply: asNumber(row.needs_reply),
    followUpsDue: asNumber(row.follow_ups_due),
    overdue: asNumber(row.overdue),
    newApplications: asNumber(row.new_applications),
    applicationsAwaitingReview: asNumber(row.applications_awaiting_review),
    newSubscribers: asNumber(row.new_subscribers),
    callsDue: asNumber(row.calls_due),
    needsReview: asNumber(row.needs_review),
    safetyIssues: asNumber(row.safety_issues),
    failedAutomations: asNumber(row.failed_automations),
  };
}
