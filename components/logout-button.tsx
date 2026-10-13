"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setPending(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to log out. Please try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={handleLogout} disabled={pending}>
        {pending ? "Logging out..." : "Log out"}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}