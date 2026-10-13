"use client";
import { ErrorRecovery } from "@/components/error-recovery";
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body style={{ fontFamily: "sans-serif", padding: "2rem", lineHeight: 1.6 }}><ErrorRecovery retry={retry} href="/" label="Return home" message="HolyHub couldn’t open this page. Try again, or return home. Check your purchases before repeating a payment." /></body></html>;
}
