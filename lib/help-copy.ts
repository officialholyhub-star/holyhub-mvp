export const FULFILMENT_HELP = {
  toFulfil: "Orders that still need action from you.",
  pending: "Paid orders you haven’t started preparing yet.",
  packed: "Orders you’re currently preparing.",
  dispatched: "Orders that have been sent to the customer.",
  delivered: "Orders marked as delivered.",
  privateNote: "For your own records. Not shown in customer order updates.",
  export: "Download order information as a spreadsheet/CSV file.",
} as const;

export const LISTING_STATUS_LABELS = {
  draft: "Draft",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Changes requested",
} as const;

export const LISTING_HELP = {
  draft: "Saved but not submitted for review.",
  pending: "Submitted and waiting for HolyHub approval.",
  approved: "Approved by HolyHub and eligible to appear publicly.",
  rejected: "Not approved. Check the reason before editing and resubmitting.",
} as const;
