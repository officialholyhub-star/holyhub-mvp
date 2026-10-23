import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { assertCrmDatabaseEnvironment, getCrmDb } from "@/lib/crm/db/client";
import { integrationEvents } from "@/lib/crm/db/schema";

export type ReceiveIntegrationEventInput = {
  sourceSystem: string;
  sourceEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  payloadHash?: string | null;
};

export async function receiveIntegrationEvent(input: ReceiveIntegrationEventInput) {
  await assertCrmDatabaseEnvironment();
  const db = getCrmDb();

  const [inserted] = await db
    .insert(integrationEvents)
    .values({
      sourceSystem: input.sourceSystem,
      sourceEventId: input.sourceEventId,
      eventType: input.eventType,
      payload: input.payload,
      payloadHash: input.payloadHash ?? null,
      status: "received",
    })
    .onConflictDoNothing({ target: [integrationEvents.sourceSystem, integrationEvents.sourceEventId] })
    .returning();

  if (inserted) return { event: inserted, duplicate: false };

  const [existing] = await db
    .select()
    .from(integrationEvents)
    .where(and(eq(integrationEvents.sourceSystem, input.sourceSystem), eq(integrationEvents.sourceEventId, input.sourceEventId)))
    .limit(1);

  if (!existing) throw new Error("Integration event idempotency lookup failed.");
  return { event: existing, duplicate: true };
}

export async function markIntegrationEventFailed(eventId: string, error: string, retryAt?: Date | null) {
  await assertCrmDatabaseEnvironment();
  const db = getCrmDb();
  const [updated] = await db
    .update(integrationEvents)
    .set({
      status: retryAt ? "retry" : "failed",
      attemptCount: sql`${integrationEvents.attemptCount} + 1`,
      nextRetryAt: retryAt ?? null,
      lastError: error.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(integrationEvents.id, eventId))
    .returning();
  if (!updated) throw new Error("Integration event not found.");
  return updated;
}
