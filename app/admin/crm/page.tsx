import { requireCrmUser } from "@/lib/crm/auth";
import { getCrmDashboardCounts } from "@/lib/crm/services/dashboard";

export const dynamic = "force-dynamic";

const cards: Array<{ key: keyof Awaited<ReturnType<typeof getCrmDashboardCounts>>; label: string; description: string }> = [
  { key: "needsReply", label: "Needs reply", description: "Relationships waiting for a HolyHub response." },
  { key: "followUpsDue", label: "Follow-ups due", description: "Open follow-up actions that are now due." },
  { key: "overdue", label: "Overdue", description: "Open actions beyond their due time." },
  { key: "newApplications", label: "New applications", description: "Applications received in the last seven days." },
  { key: "applicationsAwaitingReview", label: "Awaiting review", description: "Submitted or under-review applications." },
  { key: "newSubscribers", label: "New subscribers", description: "Active synthetic subscribers added in the last seven days." },
  { key: "callsDue", label: "Calls due", description: "Open call actions ready to handle." },
  { key: "needsReview", label: "Needs review", description: "Actions or integration events that require a human decision." },
  { key: "safetyIssues", label: "Safety controls", description: "Active suppression/contact-safety records." },
  { key: "failedAutomations", label: "Automation health", description: "Automations in degraded, failed or review state." },
];

export default async function CrmDashboardPage() {
  const { crmUser } = await requireCrmUser();
  const counts = await getCrmDashboardCounts();

  return (
    <section className="admin-workspace">
      <div className="admin-workspace-header">
        <div>
          <p className="eyebrow">HolyHub CRM · Sandbox</p>
          <h1>Relationship Control Centre</h1>
          <p className="lead">Synthetic-data oversight for the approved N18 Sandbox Foundation.</p>
        </div>
        <span className="admin-summary">{crmUser.displayName} · {crmUser.crmRole}</span>
      </div>

      <div className="admin-overview-grid">
        {cards.map((card) => (
          <article className="admin-overview-card" key={card.key}>
            <span className="admin-card-kicker">CRM</span>
            <strong>{counts[card.key]}</strong>
            <h2>{card.label}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </div>

      <p className="muted-small">Sandbox only. HubSpot remains HolyHub&apos;s live CRM and no live Gmail/Tally integration is enabled here.</p>
    </section>
  );
}
