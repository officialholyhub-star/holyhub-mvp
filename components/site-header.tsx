import Link from "next/link";
import { CustomerSetupReminder } from "@/components/customer-setup-reminder";
import { createClient } from "@/lib/supabase/server";
import { HolyHubIcon } from "@/components/holyhub-icon";
import { SiteMenu } from "@/components/site-menu";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isLister = false;
  let isAdmin = false;
  if (user) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["lister", "admin"]);

    isLister = roles?.some(({ role }) => role === "lister") ?? false;
    isAdmin = roles?.some(({ role }) => role === "admin") ?? false;
  }

  return (
    <header className="site-header">
      {user && <CustomerSetupReminder userId={user.id} />}
      <div className="site-header-inner">
        <Link className="home-nav-button" href="/" aria-label="Home">
          <HolyHubIcon name="home" />
          <span>Home</span>
        </Link>

        <nav className="main-nav" aria-label="Main HolyHub sections">
          <Link href="/hub">The Hub</Link>
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/events">Events</Link>
        </nav>

        <div className="header-tools">
          <Link className="basket-link" href="/basket" aria-label="Open basket"><HolyHubIcon name="basket" /><span>Basket</span></Link>
          <SiteMenu isLister={isLister} isAdmin={isAdmin} user={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
