export type OrderConfirmationAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  country: string;
};

export type OrderConfirmationItem = {
  productName: string;
  variantSize?: string | null;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
};

export type OrderConfirmationSeller = {
  sellerBusinessName: string;
  sellerLegalName: string;
  sellerEntityType: string;
  sellerGeographicalAddress: OrderConfirmationAddress;
  sellerServiceAddress?: OrderConfirmationAddress | null;
  sellerContactEmail: string;
  sellerTelephone?: string | null;
  registrationNumber?: string | null;
  registrationJurisdiction?: string | null;
  registeredOffice?: OrderConfirmationAddress | null;
  vatNumber?: string | null;
  deliveryAmount: number;
  deliveryTerms: string;
  items: OrderConfirmationItem[];
};

export type OrderConfirmationInput = {
  orderId: string;
  orderDateIso: string;
  customerEmail: string;
  currency: "gbp" | "GBP";
  productSubtotal: number;
  deliveryTotal: number;
  totalAmount: number;
  deliveryAddress: OrderConfirmationAddress;
  sellers: OrderConfirmationSeller[];
};

export type OrderConfirmationBlocker =
  | "missing_order_id"
  | "invalid_order_date"
  | "missing_customer_email"
  | "invalid_currency"
  | "invalid_amounts"
  | "invalid_delivery_address"
  | "missing_seller"
  | "missing_seller_identity"
  | "missing_seller_contact"
  | "missing_company_details"
  | "missing_delivery_terms"
  | "missing_item"
  | "invalid_item_amounts"
  | "amount_mismatch";

type RenderedOrderConfirmation = {
  ok: true;
  idempotencyKey: string;
  subject: string;
  text: string;
  html: string;
};

type BlockedOrderConfirmation = {
  ok: false;
  blockers: OrderConfirmationBlocker[];
};

const MARKETPLACE_ROLE = "HolyHub is the marketplace connecting customers with independent Christian brands. Products are supplied and sold by the named seller, while HolyHub provides the marketplace, checkout and support experience.";
const CONFORMING_GOODS = "The seller is under a legal duty to supply goods that conform to the contract. Your statutory rights for faulty, damaged, misdescribed or otherwise non-conforming goods are not reduced by the cancellation information below.";
const CANCELLATION_RIGHTS = "For most eligible goods bought online, you can normally tell the seller that you want to cancel up to 14 days after the day you receive the goods. Where one order is delivered separately, the cancellation period may run from receipt of the last goods, lot or piece as the law provides. Unless the seller has offered to collect the goods, you must then return them without undue delay and no later than 14 days after telling the seller that you are cancelling. Exceptions can apply, including certain personalised or custom-made goods, perishable items and sealed hygiene goods once unsealed.";
const REFUND_RIGHTS = "For a change-of-mind return, you normally bear the direct return cost where the seller gave the required information about that cost before purchase. A valid cancellation refund includes the cost of the least expensive common and generally acceptable delivery option offered by the seller; any extra amount paid for a more expensive delivery option does not have to be refunded. If the seller has not offered to collect the goods, the refund must be made without undue delay and no later than 14 days after the seller receives the goods back or, if earlier, after you provide evidence that you sent them back. In other cases, the refund must be made no later than 14 days after the seller is informed of the cancellation. The refund must use the same payment method unless you expressly agree otherwise, and no refund fee may be imposed. The seller may be able to deduct an amount for diminished value caused by handling beyond what is necessary to establish the nature, characteristics and functioning of the goods, where the law allows.";
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isNonNegativePence(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validAddress(address: OrderConfirmationAddress | null | undefined) {
  return Boolean(address && clean(address.line1) && clean(address.city) && clean(address.postcode) && clean(address.country));
}

function validEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function formatMoney(pence: number) {
  return money.format(pence / 100);
}

function formatAddress(address: OrderConfirmationAddress) {
  return [address.line1, address.line2, address.city, address.postcode, address.country]
    .map(clean)
    .filter(Boolean)
    .join(", ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function entityLabel(value: string) {
  switch (value) {
    case "sole_trader": return "Sole trader";
    case "limited_company": return "Limited company";
    case "llp": return "Limited liability partnership (LLP)";
    case "partnership": return "Partnership";
    case "charity_nonprofit": return "Charity / non-profit";
    default: return "Other organisation";
  }
}

function isRegisteredEntity(value: string) {
  return value === "limited_company" || value === "llp";
}

export function orderConfirmationIdempotencyKey(orderId: string) {
  return `order:${orderId.trim()}:customer-confirmation:v1`;
}

export function validateOrderConfirmation(input: OrderConfirmationInput): OrderConfirmationBlocker[] {
  const blockers = new Set<OrderConfirmationBlocker>();
  if (!clean(input.orderId)) blockers.add("missing_order_id");
  if (!Number.isFinite(Date.parse(input.orderDateIso))) blockers.add("invalid_order_date");
  if (!validEmail(clean(input.customerEmail))) blockers.add("missing_customer_email");
  if (input.currency.toLowerCase() !== "gbp") blockers.add("invalid_currency");
  if (![input.productSubtotal, input.deliveryTotal, input.totalAmount].every(isNonNegativePence)) blockers.add("invalid_amounts");
  if (!validAddress(input.deliveryAddress)) blockers.add("invalid_delivery_address");
  if (!input.sellers.length) blockers.add("missing_seller");

  let itemTotal = 0;
  let deliveryTotal = 0;
  for (const seller of input.sellers) {
    if (!clean(seller.sellerLegalName) || !clean(seller.sellerEntityType) || !validAddress(seller.sellerGeographicalAddress)) {
      blockers.add("missing_seller_identity");
    }
    if (seller.sellerServiceAddress && !validAddress(seller.sellerServiceAddress)) blockers.add("missing_seller_identity");
    if (!validEmail(clean(seller.sellerContactEmail))) blockers.add("missing_seller_contact");
    if (isRegisteredEntity(seller.sellerEntityType) && (!clean(seller.registrationNumber) || !clean(seller.registrationJurisdiction) || !validAddress(seller.registeredOffice))) {
      blockers.add("missing_company_details");
    }
    if (!clean(seller.deliveryTerms)) blockers.add("missing_delivery_terms");
    if (!seller.items.length) blockers.add("missing_item");
    if (!isNonNegativePence(seller.deliveryAmount)) blockers.add("invalid_amounts");
    deliveryTotal += seller.deliveryAmount;

    for (const item of seller.items) {
      if (!clean(item.productName)) blockers.add("missing_item");
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || !isNonNegativePence(item.unitAmount) || !isNonNegativePence(item.lineTotal)) blockers.add("invalid_item_amounts");
      if (item.lineTotal !== item.unitAmount * item.quantity) blockers.add("invalid_item_amounts");
      itemTotal += item.lineTotal;
    }
  }

  if (itemTotal !== input.productSubtotal || deliveryTotal !== input.deliveryTotal || input.productSubtotal + input.deliveryTotal !== input.totalAmount) {
    blockers.add("amount_mismatch");
  }
  return [...blockers];
}

function cancellationFormText(seller: OrderConfirmationSeller, index: number) {
  return [
    `Model cancellation form — Seller ${index + 1} (use only if you wish to cancel an eligible contract; using this form is not obligatory):`,
    `To: ${seller.sellerLegalName}, ${formatAddress(seller.sellerGeographicalAddress)}, ${seller.sellerContactEmail}${seller.sellerTelephone ? `, ${seller.sellerTelephone}` : ""}`,
    "I/We hereby give notice that I/We cancel my/our contract of sale of the following goods:",
    "[Goods]",
    "Ordered on / received on:",
    "Name of consumer(s):",
    "Address of consumer(s):",
    "Signature of consumer(s) (only if this form is notified on paper):",
    "Date:",
  ].join("\n");
}

function sellerExtraText(seller: OrderConfirmationSeller) {
  return [
    `Legal structure: ${entityLabel(seller.sellerEntityType)}`,
    seller.sellerServiceAddress ? `Service address: ${formatAddress(seller.sellerServiceAddress)}` : null,
    seller.registrationNumber ? `Registration number: ${seller.registrationNumber}` : null,
    seller.registrationJurisdiction ? `Registered in: ${seller.registrationJurisdiction}` : null,
    seller.registeredOffice ? `Registered office: ${formatAddress(seller.registeredOffice)}` : null,
    seller.vatNumber ? `VAT number: ${seller.vatNumber}` : null,
  ].filter(Boolean).join("\n");
}

export function renderOrderConfirmation(input: OrderConfirmationInput): RenderedOrderConfirmation | BlockedOrderConfirmation {
  const blockers = validateOrderConfirmation(input);
  if (blockers.length) return { ok: false, blockers };

  const orderDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(input.orderDateIso));
  const sellerText = input.sellers.map((seller, index) => {
    const tradingName = clean(seller.sellerBusinessName) && seller.sellerBusinessName !== seller.sellerLegalName
      ? `${seller.sellerBusinessName} (legal name: ${seller.sellerLegalName})`
      : seller.sellerLegalName;
    const items = seller.items.map(item => `- ${item.productName}${item.variantSize ? ` — ${item.variantSize}` : ""} × ${item.quantity} — ${formatMoney(item.lineTotal)} (${formatMoney(item.unitAmount)} each)`).join("\n");
    return [
      `Seller ${index + 1}: ${tradingName}`,
      `Seller address: ${formatAddress(seller.sellerGeographicalAddress)}`,
      sellerExtraText(seller),
      `Seller email: ${seller.sellerContactEmail}`,
      seller.sellerTelephone ? `Seller telephone: ${seller.sellerTelephone}` : null,
      items,
      `Dispatch: ${seller.deliveryTerms}`,
      `Delivery charge: ${formatMoney(seller.deliveryAmount)}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const cancellationForms = input.sellers.map(cancellationFormText).join("\n\n");
  const text = [
    "Thank you for your HolyHub order.",
    MARKETPLACE_ROLE,
    "",
    `Order reference: ${input.orderId}`,
    `Order date: ${orderDate}`,
    `Delivery address: ${formatAddress(input.deliveryAddress)}`,
    "",
    sellerText,
    "",
    `Products subtotal: ${formatMoney(input.productSubtotal)}`,
    `Delivery total: ${formatMoney(input.deliveryTotal)}`,
    `Total paid: ${formatMoney(input.totalAmount)}`,
    "",
    "Consumer rights, cancellations, returns and refunds",
    CONFORMING_GOODS,
    CANCELLATION_RIGHTS,
    REFUND_RIGHTS,
    "Physical returns normally go to the seller who supplied the product. Do not send returns to HolyHub unless HolyHub specifically tells you to do so.",
    "",
    cancellationForms,
    "",
    "Need help? Contact HolyHub at official.holyhub@gmail.com and include your order reference and the seller/product involved.",
  ].join("\n");

  const htmlSellers = input.sellers.map((seller, index) => {
    const tradingName = clean(seller.sellerBusinessName) && seller.sellerBusinessName !== seller.sellerLegalName
      ? `${seller.sellerBusinessName} (legal name: ${seller.sellerLegalName})`
      : seller.sellerLegalName;
    const items = seller.items.map(item => `<li>${escapeHtml(item.productName)}${item.variantSize ? ` — ${escapeHtml(item.variantSize)}` : ""} × ${item.quantity} — ${escapeHtml(formatMoney(item.lineTotal))} (${escapeHtml(formatMoney(item.unitAmount))} each)</li>`).join("");
    const extra = [
      `<p><strong>Legal structure:</strong> ${escapeHtml(entityLabel(seller.sellerEntityType))}</p>`,
      seller.sellerServiceAddress ? `<p><strong>Service address:</strong> ${escapeHtml(formatAddress(seller.sellerServiceAddress))}</p>` : "",
      seller.registrationNumber ? `<p><strong>Registration number:</strong> ${escapeHtml(seller.registrationNumber)}</p>` : "",
      seller.registrationJurisdiction ? `<p><strong>Registered in:</strong> ${escapeHtml(seller.registrationJurisdiction)}</p>` : "",
      seller.registeredOffice ? `<p><strong>Registered office:</strong> ${escapeHtml(formatAddress(seller.registeredOffice))}</p>` : "",
      seller.vatNumber ? `<p><strong>VAT number:</strong> ${escapeHtml(seller.vatNumber)}</p>` : "",
    ].join("");
    const telephone = seller.sellerTelephone ? `<p><strong>Seller telephone:</strong> ${escapeHtml(seller.sellerTelephone)}</p>` : "";
    return `<section><h3>Seller ${index + 1}: ${escapeHtml(tradingName)}</h3><p><strong>Seller address:</strong> ${escapeHtml(formatAddress(seller.sellerGeographicalAddress))}</p>${extra}<p><strong>Seller email:</strong> ${escapeHtml(seller.sellerContactEmail)}</p>${telephone}<ul>${items}</ul><p><strong>Dispatch:</strong> ${escapeHtml(seller.deliveryTerms)}</p><p><strong>Delivery charge:</strong> ${escapeHtml(formatMoney(seller.deliveryAmount))}</p></section>`;
  }).join("");

  const htmlForms = input.sellers.map((seller, index) => `<section><h3>Model cancellation form — Seller ${index + 1}</h3><p>Use only if you wish to cancel an eligible contract; using this form is not obligatory.</p><p><strong>To:</strong> ${escapeHtml(seller.sellerLegalName)}, ${escapeHtml(formatAddress(seller.sellerGeographicalAddress))}, ${escapeHtml(seller.sellerContactEmail)}${seller.sellerTelephone ? `, ${escapeHtml(seller.sellerTelephone)}` : ""}</p><p>I/We hereby give notice that I/We cancel my/our contract of sale of the following goods:<br>[Goods]<br>Ordered on / received on:<br>Name of consumer(s):<br>Address of consumer(s):<br>Signature of consumer(s) (only if this form is notified on paper):<br>Date:</p></section>`).join("");

  const html = `<main><h1>HolyHub order confirmation</h1><p>Thank you for your HolyHub order.</p><p>${escapeHtml(MARKETPLACE_ROLE)}</p><p><strong>Order reference:</strong> ${escapeHtml(input.orderId)}</p><p><strong>Order date:</strong> ${escapeHtml(orderDate)}</p><p><strong>Delivery address:</strong> ${escapeHtml(formatAddress(input.deliveryAddress))}</p>${htmlSellers}<h3>Order total</h3><p>Products subtotal: ${escapeHtml(formatMoney(input.productSubtotal))}<br>Delivery total: ${escapeHtml(formatMoney(input.deliveryTotal))}<br><strong>Total paid: ${escapeHtml(formatMoney(input.totalAmount))}</strong></p><h3>Consumer rights, cancellations, returns and refunds</h3><p>${escapeHtml(CONFORMING_GOODS)}</p><p>${escapeHtml(CANCELLATION_RIGHTS)}</p><p>${escapeHtml(REFUND_RIGHTS)}</p><p>Physical returns normally go to the seller who supplied the product. Do not send returns to HolyHub unless HolyHub specifically tells you to do so.</p>${htmlForms}<p>Need help? Contact HolyHub at <a href="mailto:official.holyhub@gmail.com">official.holyhub@gmail.com</a> and include your order reference and the seller/product involved.</p></main>`;

  return {
    ok: true,
    idempotencyKey: orderConfirmationIdempotencyKey(input.orderId),
    subject: `HolyHub order confirmation — ${input.orderId}`,
    text,
    html,
  };
}
