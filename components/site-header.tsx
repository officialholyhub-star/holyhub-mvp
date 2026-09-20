import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { HeaderNavigation } from "@/components/header-navigation";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="site-header">
      <Link className="logo-wrap" href="/" aria-label="HolyHub home">
        <Image className="logo-image" src="/holyhub-logo.png" alt="HolyHub" width={168} height={85} priority />
      </Link>
      <nav className="header-actions" aria-label="Main navigation">
        <HeaderNavigation />
        <div className="header-account">
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
        </div>
      </nav>
    </header>
  );
}
