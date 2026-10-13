import { LISTER_FULFILMENT_STATUS_LABELS, type FulfilmentStatus } from "@/lib/fulfilment";
import { FULFILMENT_HELP } from "@/lib/help-copy";
import { HelpIcon } from "./help-icon";

export function FulfilmentStatusBadge({ status }: { status: string }) {
  const label = LISTER_FULFILMENT_STATUS_LABELS[status as FulfilmentStatus] ?? status;
  const help = FULFILMENT_HELP[status as keyof typeof FULFILMENT_HELP];
  return <span className="status-with-help"><span className={`status-pill status-${status}`}>{label}</span>{help && <HelpIcon label={label} text={help} />}</span>;
}
