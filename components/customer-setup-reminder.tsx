"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { firstIncomplete, readSetup, writeSetup } from "@/lib/customer-onboarding";
import styles from "./customer-onboarding.module.css";

export function CustomerSetupReminder({ userId, setupComplete = false }: { userId: string; setupComplete?: boolean }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const value = readSetup(userId);
      setVisible(!setupComplete && !value.dismissed && firstIncomplete(value) !== null);
    });
    return () => cancelAnimationFrame(frame);
  }, [userId, pathname, setupComplete]);
  if (setupComplete || !visible || pathname.startsWith("/auth/") || pathname === "/account/setup") return null;
  function dismiss() { writeSetup(userId, { ...readSetup(userId), dismissed: true }); setVisible(false); }
  return <aside className={styles.reminder} aria-label="Optional HolyHub setup"><button className={styles.dismiss} aria-label="Dismiss setup reminder for this session" onClick={dismiss}>×</button><strong>Finish setting up your HolyHub 💙</strong><p>Explore the optional setup questions. Answers aren’t saved yet.</p><Link className="text-link" href="/account/setup" onClick={dismiss}>Continue setup</Link></aside>;
}
