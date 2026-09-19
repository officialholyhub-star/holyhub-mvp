import type { ReactNode } from "react";\n\ntype HolyHubIconName =
  | "hub"
  | "marketplace"
  | "events"
  | "bible"
  | "community"
  | "opportunities"
  | "conversations"
  | "conference"
  | "worship"
  | "festival"
  | "activity"
  | "menu"
  | "basket";

const paths: Record<HolyHubIconName, ReactNode> = {
  hub: <><circle cx="12" cy="12" r="2.5" /><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></>,
  marketplace: <><path d="M4 8h16l-1.3 11H5.3L4 8Z" /><path d="M8 8a4 4 0 0 1 8 0" /></>,
  events: <><rect x="4" y="5.5" width="16" height="14" rx="3" /><path d="M8 3v5M16 3v5M4 10h16" /><path d="M8 14h3M14 14h2" /></>,
  bible: <><path d="M5 4.5h10a4 4 0 0 1 4 4V20H8a3 3 0 0 1-3-3V4.5Z" /><path d="M8 4.5V20M11 9h5M13.5 6.5v5" /></>,
  community: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 19c.6-3 2.5-4.5 5.5-4.5s4.9 1.5 5.5 4.5M14.5 15.5c2.8-.7 5 .4 6 3" /></>,
  opportunities: <><path d="M5 19 19 5M10 5h9v9" /><path d="M5 8v11h11" /></>,
  conversations: <><path d="M5 6.5h14v10H9l-4 3v-13Z" /><path d="M8 10h8M8 13h5" /></>,
  conference: <><path d="M5 19V8l7-4 7 4v11" /><path d="M8 11h8M8 15h8" /></>,
  worship: <><path d="M10 18V7l8-2v11" /><circle cx="7.5" cy="18" r="2.5" /><circle cx="15.5" cy="16" r="2.5" /></>,
  festival: <><path d="M12 3v18M5 7l7-4 7 4-7 4-7-4Z" /><path d="M5 17l7 4 7-4" /></>,
  activity: <><path d="M4 16c3-5 5-7 8-7s5 2 8 7" /><circle cx="12" cy="6" r="2" /><path d="M7 20h10" /></>,
  menu: <><path d="M5 7h14M5 12h14M5 17h14" /></>,
  basket: <><path d="M5 9h14l-1.2 10H6.2L5 9Z" /><path d="m8 9 4-5 4 5" /></>,
};

export function HolyHubIcon({ name, className = "" }: { name: HolyHubIconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
