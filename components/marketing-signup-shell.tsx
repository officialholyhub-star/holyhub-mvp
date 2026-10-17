import Link from "next/link";

type MarketingSignupShellProps = {
  source: "homepage_signup" | "church_community_qr" | "footer_signup";
  compact?: boolean;
};

export function MarketingSignupShell({ source, compact = false }: MarketingSignupShellProps) {
  return (
    <section className={compact ? "card" : "home-cta"} data-signup-source={source} aria-labelledby={`updates-heading-${source}`}>
      <div>
        <p className="eyebrow">HolyHub updates</p>
        <h2 id={`updates-heading-${source}`}>Be first to hear when HolyHub launches</h2>
        <p>Discover and support Christian brands, all in one place.</p>
      </div>
      <form className="form" aria-describedby={`updates-gate-${source}`}>
        <div className="field">
          <label htmlFor={`updates-email-${source}`}>Email address</label>
          <input id={`updates-email-${source}`} type="email" name="email" autoComplete="email" disabled />
        </div>
        <label className="terms-consent">
          <input type="checkbox" name="marketing_consent" disabled />
          <span>Yes, I’d like HolyHub to email me about the launch and send me occasional marketplace updates, including new Christian brands and products.</span>
        </label>
        <button className="button button-primary" type="button" disabled>Keep me updated</button>
        <p>You can unsubscribe at any time. See our <Link className="text-link" href="/privacy">Privacy Notice</Link>.</p>
        <p id={`updates-gate-${source}`} className="muted-small">Email signup is being prepared and is not active yet.</p>
      </form>
    </section>
  );
}
