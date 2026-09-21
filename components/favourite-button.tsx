"use client";

import { useState } from "react";
import Link from "next/link";

type FavouriteButtonProps = {
  productId: string;
  initialSaved: boolean;
};

export function FavouriteButton({ productId, initialSaved }: FavouriteButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(false);

  async function toggleFavourite() {
    if (busy) return;
    setBusy(true);
    setPrompt(false);

    try {
      const response = await fetch("/api/favourites", {
        method: saved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (response.status === 401) {
        setPrompt(true);
        return;
      }
      if (!response.ok) return;
      setSaved(!saved);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="favourite-control">
      <button
        className={`favourite-button${saved ? " is-saved" : ""}`}
        type="button"
        onClick={toggleFavourite}
        disabled={busy}
        aria-label={saved ? "Remove from favourites" : "Add to favourites"}
        aria-pressed={saved}
        title={saved ? "Remove from favourites" : "Add to favourites"}
      >
        <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      </button>
      {prompt && (
        <span className="favourite-prompt" role="status">
          <Link href="/auth/login?message=Log%20in%20to%20save%20favourites.">Sign in to save favourites</Link>
        </span>
      )}
    </span>
  );
}
