import Link from "next/link";
import { HolyHubIcon } from "@/components/holyhub-icon";

export function DiscoveryPaths() {
  return <div className="discovery-paths">
    <Link className="discovery-path path-marketplace" href="/products"><HolyHubIcon name="marketplace" /><div><small>Discover something meaningful</small><h3>The Marketplace</h3><p>Independent brands. Thoughtfully made.</p></div><span className="path-arrow" aria-hidden="true">→</span></Link>
    <Link className="discovery-path path-events" href="/events"><HolyHubIcon name="events" /><div><small>Make room for connection</small><h3>Events & gatherings</h3><p>Find your people, beyond the screen.</p></div><span className="path-arrow" aria-hidden="true">→</span></Link>
    <Link className="discovery-path path-hub" href="/hub"><HolyHubIcon name="hub" /><div><small>More than a marketplace</small><h3>The HolyHub community</h3><p>Meet the businesses behind the brands.</p></div><span className="path-arrow" aria-hidden="true">→</span></Link>
  </div>;
}
