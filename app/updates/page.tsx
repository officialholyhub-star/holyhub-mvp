import { MarketingSignupShell } from "@/components/marketing-signup-shell";

export default function UpdatesPage() {
  return (
    <section className="auth-wrap">
      <MarketingSignupShell source="church_community_qr" compact />
    </section>
  );
}
