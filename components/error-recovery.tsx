"use client";

export function ErrorRecovery({ title = "We couldn’t load this page", message = "Please try again. If this continues, contact HolyHub.", retry, href = "/account", label = "Return to account" }: { title?: string; message?: string; retry?: () => void; href?: string; label?: string }) {
  return <section className="auth-wrap"><div className="card" role="alert"><h1>{title}</h1><p>{message}</p><div className="row-actions"><button type="button" className="button button-primary" onClick={() => retry ? retry() : window.location.reload()}>Try again</button><a className="button button-quiet" href={href}>{label}</a><a className="text-link" href="/contact">Contact HolyHub</a></div></div></section>;
}
