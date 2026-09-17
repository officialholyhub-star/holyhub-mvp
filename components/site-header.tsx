import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="site-header">
      <Link className="logo-wrap" href="/" aria-label="HolyHub home">
        <Image className="logo-image" src="/holyhub-logo.png" alt="HolyHub" width={328} height={104} priority />
      </Link>
      <nav className="header-actions" aria-label="Account navigation">
        <Link className="button button-quiet" href="/marketplace">Marketplace</Link>
        <Link className="button button-quiet" href="/events">Events</Link>
        <Link className="button button-quiet" href="/basket">Basket</Link>
        {user ? (
          <>
            <Link className="button button-primary hide-mobile" href="/lister/apply">Become a Lister</Link>
            <Link className="button button-quiet hide-mobile" href="/account">My account</Link>
            <form action={logout} className="inline-form">
              <button className="button button-secondary" type="submit">Log out</button>
            </form>
          </>
        ) : (
          <>
            <Link className="button button-quiet hide-mobile" href="/auth/login">Log in</Link>
            <Link className="button button-primary" href="/auth/signup">Join HolyHub</Link>
          </>
        )}
      </nav>
    </header>
  );
}
