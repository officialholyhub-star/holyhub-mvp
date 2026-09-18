import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";

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

        <nav className="utility-nav" aria-label="Account and shopping navigation">
          <Link className="utility-link" href="/basket">Basket</Link>
          {user ? (
            <>
              <Link className="utility-link utility-hide-mobile" href={isLister ? "/lister" : "/lister/apply"}>
                {isLister ? "Lister space" : "Become a Lister"}
              </Link>
              <Link className="utility-link utility-hide-mobile" href="/account">Account</Link>
              <form action={logout} className="inline-form">
                <button className="utility-button" type="submit">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link className="utility-link utility-hide-mobile" href="/auth/login">Log in</Link>
              <Link className="button button-primary header-join" href="/auth/signup">Join</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
