import { MarketingSignupShell } from "@/components/marketing-signup-shell";

export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const params = await searchParams;
  const source = params.source === "footer_signup" ? "footer_signup" : "church_community_qr";
  return (
    <section className="auth-wrap">
      <MarketingSignupShell source={source} compact />
    </section>
  );
}
