"use client";
import { ErrorRecovery } from "@/components/error-recovery";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorRecovery retry={retry} message="We couldn’t complete this request. Refresh and check the latest details before repeating a save or payment. If this continues, contact HolyHub." />;
}
