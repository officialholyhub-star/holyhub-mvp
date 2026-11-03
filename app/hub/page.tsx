import type { Metadata } from "next";
import Link from "next/link";
import { HolyHubIcon } from "@/components/holyhub-icon";

export const metadata: Metadata = { title: "The Hub | HolyHub", description: "Discover Christian businesses, find events and introduce your own brand to HolyHub." };

export default function HubPage() {
  return <>
    <section className="hub-intro"><p className="editorial-kicker">Welcome to the Hub</p><h1>Faith connects us.<br /><span className="accent-word">People make it real.</span></h1><p className="lead">Behind every independent brand is a person, a purpose and a story. This is your starting point for discovering theirs—and sharing yours.</p></section>
    <div className="hub-paths">
      <Link href="/businesses" className="hub-path"><HolyHubIcon name="community" /><span className="editorial-kicker">01 / Discover</span><h2>Meet the businesses.</h2><p>Browse approved Christian businesses and get to know the people behind them.</p><strong>Explore businesses <span aria-hidden="true">→</span></strong></Link>
      <Link href="/events" className="hub-path"><HolyHubIcon name="events" /><span className="editorial-kicker">02 / Connect</span><h2>Find a reason to gather.</h2><p>Explore upcoming events, with the details you need to plan your visit.</p><strong>Find events <span aria-hidden="true">→</span></strong></Link>
      <Link href="/account/business" className="hub-path"><HolyHubIcon name="opportunities" /><span className="editorial-kicker">03 / Grow</span><h2>Bring your story here.</h2><p>Create a business profile, submit it for review and introduce your brand to HolyHub.</p><strong>Become a Lister <span aria-hidden="true">→</span></strong></Link>
    </div>
    <section className="hub-note"><span aria-hidden="true">✳</span><div><h2>Small connections. Meaningful beginnings.</h2><p>HolyHub is growing with its community. Business discovery and events are here; community conversations are a future chapter.</p></div><Link className="button button-quiet" href="/auth/signup">Join HolyHub <span aria-hidden="true">→</span></Link></section>
  </>;
}
