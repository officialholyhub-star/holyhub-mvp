import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { HolyHubIcon } from "@/components/holyhub-icon";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isLister = false;
  if (user) {
    const { data: listerRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "lister")
      .maybeSingle();

    isLister = Boolean(listerRole);
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="logo-wrap" href="/" aria-label="HolyHub home">
          <Image className="logo-image" src="/holyhub-logo.png" alt="HolyHub" width={328} height={104} priority />
        </Link>

        <nav className="main-nav" aria-label="Main HolyHub sections">
          <Link href="/hub">The Hub</Link>
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/events">Events</Link>
        </nav>

        <nav className="utility-nav utility-desktop" aria-label="Account and shopping navigation">
          <Link className="utility-link" href="/basket">Basket</Link>
          {user ? (
            <>
              <Link className="utility-link" href={isLister ? "/lister" : "/lister/apply"}>
                {isLister ? "Lister space" : "Become a Lister"}
              </Link>
              <Link className="utility-link" href="/account">Account</Link>
              <form action={logout} className="inline-form">
                <button className="utility-button" type="submit">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link className="utility-link" href="/auth/login">Log in</Link>
              <Link className="button button-primary header-join" href="/auth/signup">Join</Link>
            </>
          )}
        </nav>

        <div className="utility-mobile">
          <Link className="mobile-icon-link" href="/basket" aria-label="Basket"><HolyHubIcon name="basket" /></Link>
          <details className="mobile-account-menu">
            <summary aria-label="Open account menu"><HolyHubIcon name="menu" /></summary>
            <div className="mobile-account-panel">
              {user ? (
                <>
                  <Link href="/account">Account</Link>
                  <Link href={isLister ? "/lister" : "/lister/apply"}>{isLister ? "Lister space" : "Become a Lister"}</Link>
                  <Link href="/basket">Basket</Link>
                  <form action={logout}><button type="submit">Log out</button></form>
                </>
              ) : (
                <>
                  <Link href="/auth/login">Log in</Link>
                  <Link href="/auth/signup">Join HolyHub</Link>
                  <Link href="/basket">Basket</Link>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
