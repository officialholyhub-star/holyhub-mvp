import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="site-header">
      <Link className="logo-wrap" href="/" aria-label="HolyHub home">
        <Image className="logo-image" src="/holyhub-logo.png" alt="HolyHub" width={168} height={85} priority />
      </Link>
      <nav className="header-actions" aria-label="Main navigation">
        <Link className="nav-link" href="/products">Discover</Link>
        <Link className="nav-link" href="/events">Events</Link>
        <Link className="nav-link" href="/account/business">List your business</Link>
        {user ? (
          <>
            <Link className="button button-quiet" href="/account">My account</Link>
            <form action={logout} className="inline-form">
              <SubmitButton className="button button-secondary" pendingText="Leaving…">Log out</SubmitButton>
            </form>
          </>
        ) : (
          <>
            <Link className="nav-link" href="/auth/login">Log in</Link>
            <Link className="button button-primary" href="/auth/signup">Join HolyHub</Link>
          </>
        )}
      </nav>
    </header>
  );
}
