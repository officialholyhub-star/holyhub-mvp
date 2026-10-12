"use client";
import { useEffect, useRef } from "react";
import { advanceOnboarding } from "@/app/lister/onboarding/actions";
export function ListerWelcome() {
  const later = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="lister-welcome-dialog" aria-labelledby="welcome-title" onCancel={event => { event.preventDefault(); later.current?.requestSubmit(); }}><h2 id="welcome-title">Welcome to HolyHub! 🎉</h2><p>You’re officially a HolyHub lister 💙</p><p>We’ll guide you through getting your shop ready. It only takes a few minutes.</p><ul><li>Set up your shop</li><li>Choose your delivery settings</li><li>Add your first product</li><li>Submit it for HolyHub review</li></ul><form action={advanceOnboarding}><button name="step" value="2" className="button button-primary" autoFocus>Start setting up my shop →</button></form><p>You can finish later at any time.</p><form ref={later} action={advanceOnboarding}><input type="hidden" name="later" value="1" /><input type="hidden" name="resume_step" value="2" /><button name="later" value="1" className="button button-quiet">Finish later</button></form></dialog>;
}
