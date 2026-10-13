"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HolyHubIcon } from "@/components/holyhub-icon";
import { LogoutButton } from "@/components/logout-button";

type SiteMenuProps = {
  isLister: boolean;
  isAdmin: boolean;
  user: boolean;
};

export function SiteMenu({ isLister, isAdmin, user }: SiteMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("menu-is-open");
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("menu-is-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="site-menu" ref={menuRef}>
      <button className="menu-trigger" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <HolyHubIcon name={open ? "close" : "menu"} />
        <span>{open ? "Close" : "Menu"}</span>
      </button>
      {open && <div className="site-menu-backdrop" aria-hidden="true" onClick={close} />}
      {open && <div className="site-menu-panel is-open">
        <div className="site-menu-heading"><span>HolyHub</span><button className="menu-close" type="button" aria-label="Close menu" onClick={close}><HolyHubIcon name="close" /></button></div>
        <nav aria-label="More HolyHub navigation">
          <Link href="/hub" onClick={close}>The Hub</Link>
          <Link href="/marketplace" onClick={close}>Marketplace</Link>
          <Link href="/events" onClick={close}>Events</Link>
          <span className="menu-divider" />
          {user ? (
            <>
              <Link href={isLister ? "/lister" : "/lister/apply"} onClick={close}>{isLister ? "Lister Space" : "Become a Lister"}</Link>
              <Link href="/account/favourites" onClick={close}>Favourites</Link>
              <Link href="/account" onClick={close}>Account</Link>
              {isAdmin && <Link href="/admin" onClick={close}>Admin</Link>}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login" onClick={close}>Log in</Link>
              <Link href="/auth/signup" onClick={close}>Join HolyHub</Link>
            </>
          )}
        </nav>
      </div>}
    </div>
  );
}