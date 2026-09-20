import type { ComponentProps } from "react";

// Full-document navigation keeps authentication and Worker routing consistent
// across Sites dispatch. Forms retain their progressive client-side feedback.
export default function SiteLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
