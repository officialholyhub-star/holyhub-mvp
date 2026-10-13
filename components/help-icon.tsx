"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./help-icon.module.css";

const openEvent = "holyhub:help-open";

export function HelpIcon({ label, text }: { label: string; text: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  function cancelClose() {
    if (timer.current) clearTimeout(timer.current);
  }
  function show() {
    cancelClose();
    document.dispatchEvent(new CustomEvent(openEvent, { detail: id }));
    setOpen(true);
  }
  function hide() {
    cancelClose();
    pinned.current = false;
    setOpen(false);
  }
  function leave() {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!pinned.current && document.activeElement !== button.current) setOpen(false);
    }, 150);
  }

  useEffect(() => {
    function anotherOpened(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) {
        if (timer.current) clearTimeout(timer.current);
        pinned.current = false;
        setOpen(false);
      }
    }
    document.addEventListener(openEvent, anotherOpened);
    return () => {
      document.removeEventListener(openEvent, anotherOpened);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id]);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      const target = event.target as Node;
      if (!button.current?.contains(target) && !tooltip.current?.contains(target)) {
        pinned.current = false;
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        pinned.current = false;
        setOpen(false);
      }
    }
    function moved() { pinned.current = false; setOpen(false); }
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", moved);
    window.addEventListener("scroll", moved, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", moved);
      window.removeEventListener("scroll", moved, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !button.current || !tooltip.current) return;
    const anchor = button.current.getBoundingClientRect();
    const box = tooltip.current.getBoundingClientRect();
    const left = Math.max(12, Math.min(anchor.left + anchor.width / 2 - box.width / 2, window.innerWidth - box.width - 12));
    const above = anchor.top - box.height - 8;
    const top = above >= 12 ? above : Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - box.height - 12));
    tooltip.current.style.left = `${left}px`;
    tooltip.current.style.top = `${top}px`;
  }, [open, text]);

  return (
    <span className={styles.root}>
      <button ref={button} className={styles.icon} type="button" aria-label={`About ${label}`} aria-describedby={id} aria-expanded={open}
        onPointerEnter={event => { if (event.pointerType !== "touch") show(); }} onPointerLeave={leave}
        onFocus={show} onBlur={hide}
        onClick={event => { event.preventDefault(); event.stopPropagation(); if (pinned.current) hide(); else { pinned.current = true; show(); } }}>
        <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18" fill="none"><circle cx="9" cy="9" r="7.25" stroke="currentColor" /><path d="M9 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="9" cy="5.5" r=".85" fill="currentColor" /></svg>
      </button>
      {!open && <span id={id} className={styles.srOnly}>{text}</span>}
      {open && createPortal(<span ref={tooltip} id={id} role="tooltip" className={styles.tooltip} style={{ left: 12, top: 12 }} onPointerEnter={cancelClose} onPointerLeave={leave}>{text}</span>, document.body)}
    </span>
  );
}
