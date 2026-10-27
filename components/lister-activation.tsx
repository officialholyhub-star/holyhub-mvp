import Link from "next/link";
import type { ActivationGate, ListerActivation } from "@/lib/lister-activation";

export function activationLabel(kind: "identity" | "dispatch" | "terms", gate: ActivationGate) {
  if (gate.state === "error") return "Status unavailable — refresh to check";
  if (kind === "identity") return gate.state === "complete" ? "Verified" : gate.state === "pending_review" ? "Waiting for HolyHub verification" : gate.reason === "rejected" ? "Changes required" : "Seller details needed";
  if (kind === "dispatch") return gate.state === "complete" ? gate.detail : gate.reason === "invalid" ? "Dispatch promise needs correcting" : "Choose your dispatch promise";
  return gate.state === "complete" ? `Current version accepted · ${gate.detail}` : gate.state === "waiting" ? "Waiting for HolyHub — final Terms are under legal review" : `Current version needs acceptance · ${gate.detail}`;
}

export function ListerActivationSummary({ activation, onboarding = false, admin = false }: { activation: ListerActivation; onboarding?: boolean; admin?: boolean }) {
  const suffix = onboarding ? "?onboarding=1" : "";
  const gates = [
    { key: "identity", title: "Seller details", href: "/lister/legal-details" },
    { key: "dispatch", title: "Dispatch promise", href: "/lister/storefront" },
    { key: "terms", title: "Lister Terms", href: "/lister/terms" },
  ] as const;
  return <section className="card" aria-label="Activation requirements">
    <h2>Activation requirements</h2>
    <p>{activation.ready ? "All three activation requirements are complete. Product approval and publication are still required." : "Customer sales remain unavailable until all three requirements are complete. Shop and product preparation can continue."}</p>
    <ul>{gates.map(({ key, title, href }) => <li key={key}>
      <strong>{title}: </strong>{activationLabel(key, activation[key])}
      {activation[key].reason === "rejected" && activation[key].detail && <p>{activation[key].detail}</p>}
      {!admin && <> · <Link href={`${href}${suffix}`}>{activation[key].state === "complete" ? "View" : activation[key].state === "pending_review" || activation[key].state === "waiting" ? "Check status" : "Review"} {title.toLowerCase()}</Link></>}
    </li>)}</ul>
  </section>;
}
