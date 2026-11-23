"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, type CSSProperties } from "react";
import { signup } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import styles from "./customer-onboarding.module.css";

export function CustomerOnboarding({ error }: { error?: string }) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [fields, setFields] = useState({ full_name: "", email: "", password: "", confirm_password: "", accept_terms: false, marketing: false });
  const heading = useRef<HTMLHeadingElement>(null);
  const [state, formAction, pending] = useActionState(async (_previous: { error?: string; next?: string; userId?: string }, formData: FormData) => {
    try {
      const result = await signup(formData);
      if (result.next) {
        setFields({ full_name: "", email: "", password: "", confirm_password: "", accept_terms: false, marketing: false });
      }
      return result;
    }
    catch { return { error: "We couldn’t create your account. Please try again." }; }
  }, { error });

  const welcome = Boolean(state.next);
  const destination = state.next === "/account" ? "/marketplace" : state.next;

  useEffect(() => { heading.current?.focus(); }, [ageConfirmed, welcome]);

  if (!ageConfirmed) return <section className="auth-wrap"><div className="card">
    <h1>HolyHub is for adults aged 18 or over</h1>
    <p>Confirm your age before creating an account.</p>
    <form onSubmit={event => { event.preventDefault(); setAgeConfirmed(true); }}>
      <label className="terms-consent"><input type="checkbox" required /><span>I confirm I am aged 18 or over.</span></label>
      <button className="button button-primary" type="submit">Continue</button>
    </form>
    <Link href="/marketplace">Browse the marketplace without an account</Link>
  </div></section>;

  if (welcome) return <CustomerWelcome destination={destination || "/marketplace"} />;

  return <section className={`auth-wrap ${styles.wrap}`}>
    <div className={`card ${styles.card}`}>
      <div className={styles.step}>
        <p className="eyebrow">Join HolyHub</p>
        <h1 ref={heading} tabIndex={-1}>Create your HolyHub account</h1>
        <p className={styles.helper}>Shop, save your favourites and manage your orders in one place.</p>
        <form className="form" onSubmit={event => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}>
          <input type="hidden" name="age_18_plus_confirmed" value={ageConfirmed ? "on" : ""} />
          <div className="field"><label htmlFor="full_name">Name</label><input id="full_name" name="full_name" autoComplete="name" value={fields.full_name} onChange={event => setFields(current => ({ ...current, full_name: event.target.value }))} maxLength={100} required /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" value={fields.email} onChange={event => setFields(current => ({ ...current, email: event.target.value }))} required /></div>
          <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="new-password" value={fields.password} onChange={event => setFields(current => ({ ...current, password: event.target.value }))} minLength={12} maxLength={128} required /><small>Use 12–128 characters.</small></div>
          <div className="field"><label htmlFor="confirm_password">Confirm password</label><PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" value={fields.confirm_password} onChange={event => setFields(current => ({ ...current, confirm_password: event.target.value }))} minLength={12} maxLength={128} required /></div>
          <label className="terms-consent"><input type="checkbox" name="accept_terms" checked={fields.accept_terms} onChange={event => setFields(current => ({ ...current, accept_terms: event.target.checked }))} required /><span>I agree to the <Link href="/terms">Customer Terms</Link> and acknowledge the <Link href="/privacy">Privacy Notice</Link>.</span></label>
          <label className="terms-consent"><input type="checkbox" checked={fields.marketing} onChange={event => setFields(current => ({ ...current, marketing: event.target.checked }))} aria-describedby="marketing-status" /><span>Yes, I’d like HolyHub to email me about the launch and send me occasional marketplace updates, including new Christian brands and products.</span></label>
          <p id="marketing-status" className={styles.note}>Email subscriptions aren’t available yet. This preference won’t be saved and won’t subscribe you to emails.</p>
          {state.error && <p role="alert" className="notice notice-error">{state.error}</p>}
          <div className={styles.actions}><button className="button button-primary" type="submit" disabled={pending}>{pending ? "Creating your account…" : "Create account"}</button></div>
        </form>
      </div>
      <div className="form-footer"><span>Already have an account?</span><Link className="text-link" href="/auth/login">Sign in</Link></div>
    </div>
  </section>;
}

function CustomerWelcome({ destination }: { destination: string }) {
  const router = useRouter();
  const [celebration, setCelebration] = useState("pending");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let startFrame = 0;
    let finishTimer = 0;
    let navigationTimer = 0;
    const update = () => setCelebration(motion.matches ? "reduced" : "falling");
    const frame = requestAnimationFrame(() => {
      startFrame = requestAnimationFrame(() => {
        update();
        finishTimer = window.setTimeout(() => setCelebration("complete"), 3100);
        navigationTimer = window.setTimeout(() => router.replace(destination), 4200);
      });
    });
    motion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(startFrame);
      window.clearTimeout(finishTimer); window.clearTimeout(navigationTimer);
      motion.removeEventListener("change", update);
    };
  }, [destination, router]);
  return <section className={styles.welcome} data-celebration={celebration} aria-labelledby="customer-welcome-heading">
    {celebration === "falling" && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 84 }, (_, index) => <i key={index} style={{ "--x": `${(index * 37) % 100}%`, "--drift": `${(index % 2 ? 1 : -1) * (20 + index % 60)}px`, "--delay": `${index % 12 * 55}ms`, "--colour": ["#4889ae", "#87c3df", "#bc9348", "#cc889f"][index % 4] } as CSSProperties} />)}</div>}
    <div className={styles.welcomeContent}><span aria-hidden="true">💙</span><h1 id="customer-welcome-heading" ref={heading} tabIndex={-1}>Welcome to HolyHub 💙</h1><p>Connect. Discover. Grow.</p><Link className="button button-primary" href={destination}>Continue</Link></div>
  </section>;
}
