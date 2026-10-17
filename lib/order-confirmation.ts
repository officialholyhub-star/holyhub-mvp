export type OrderConfirmationAddress = {
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  country: string;
};

export type OrderConfirmationItem = {
  productName: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
};

export type OrderConfirmationSeller = {
  sellerBusinessName: string;
  sellerLegalName: string;
  sellerGeographicalAddress: OrderConfirmationAddress;
  sellerContactEmail: string;
  sellerTelephone?: string | null;
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

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isNonNegativePence(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validAddress(address: OrderConfirmationAddress) {
  return Boolean(clean(address.line1) && clean(address.city) && clean(address.postcode) && clean(address.country));
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

export function orderConfirmationIdempotencyKey(orderId: string) {
  return `customer-order-confirmation:${orderId.trim()}`;
}

export function validateOrderConfirmation(input: OrderConfirmationInput): OrderConfirmationBlocker[] {
  const blockers = new Set<OrderConfirmationBlocker>();
  if (!clean(input.orderId)) blockers.add("missing_order_id");
  if (!Number.isFinite(Date.parse(input.orderDateIso))) blockers.add("invalid_order_date");
  if (!validEmail(clean(input.customerEmail))) blockers.add("missing_customer_email");
  if (input.currency.toLowerCase() !== "gbp") blockers.add("invalid_currency");
  if (![input.productSubtotal, input.deliveryTotal, input.totalAmount].every(isNonNegativePence)) {
    blockers.add("invalid_amounts");
  }
  if (!validAddress(input.deliveryAddress)) blockers.add("invalid_delivery_address");
  if (!input.sellers.length) blockers.add("missing_seller");

  let itemTotal = 0;
  let deliveryTotal = 0;
  for (const seller of input.sellers) {
    if (!clean(seller.sellerBusinessName) || !clean(seller.sellerLegalName) || !validAddress(seller.sellerGeographicalAddress)) {
      blockers.add("missing_seller_identity");
    }
    if (!validEmail(clean(seller.sellerContactEmail))) blockers.add("missing_seller_contact");
    if (!clean(seller.deliveryTerms)) blockers.add("missing_delivery_terms");
    if (!seller.items.length) blockers.add("missing_item");
    if (!isNonNegativePence(seller.deliveryAmount)) blockers.add("invalid_amounts");
    deliveryTotal += seller.deliveryAmount;

    for (const item of seller.items) {
      if (!clean(item.productName)) blockers.add("missing_item");
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || !isNonNegativePence(item.unitAmount) || !isNonNegativePence(item.lineTotal)) {
        blockers.add("invalid_item_amounts");
      }
      if (item.lineTotal !== item.unitAmount * item.quantity) blockers.add("invalid_item_amounts");
      itemTotal += item.lineTotal;
    }
  }

  if (
    itemTotal !== input.productSubtotal
    || deliveryTotal !== input.deliveryTotal
    || input.productSubtotal + input.deliveryTotal !== input.totalAmount
  ) {
    blockers.add("amount_mismatch");
  }

  return [...blockers];
}

function cancellationFormText() {
  return [
    "Model cancellation form (use only if you wish to cancel an eligible contract; using this form is not obligatory):",
    "To: [seller legal name and geographical address shown above for the relevant item]",
    "I/We hereby give notice that I/We cancel my/our contract of sale of the following goods:",
    "[Goods]",
    "Ordered on / received on:",
    "Name of consumer(s):",
    "Address of consumer(s):",
    "Signature of consumer(s) (only if this form is notified on paper):",
    "Date:",
  ].join("\n");
}

export function renderOrderConfirmation(input: OrderConfirmationInput): RenderedOrderConfirmation | BlockedOrderConfirmation {
  const blockers = validateOrderConfirmation(input);
  if (blockers.length) return { ok: false, blockers };

  const orderDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })
    .format(new Date(input.orderDateIso));
  const sellerText = input.sellers.map((seller, index) => {
    const tradingName = seller.sellerBusinessName === seller.sellerLegalName
      ? seller.sellerLegalName
      : `${seller.sellerBusinessName} (legal name: ${seller.sellerLegalName})`;
    const items = seller.items.map(item => `- ${item.productName} × ${item.quantity} — ${formatMoney(item.lineTotal)} (${formatMoney(item.unitAmount)} each)`).join("\n");
    return [
      `Seller ${index + 1}: ${tradingName}`,
      `Seller address: ${formatAddress(seller.sellerGeographicalAddress)}`,
      `Seller email: ${seller.sellerContactEmail}`,
      seller.sellerTelephone ? `Seller telephone: ${seller.sellerTelephone}` : null,
      items,
      `Delivery: ${seller.deliveryTerms}`,
      `Delivery charge: ${formatMoney(seller.deliveryAmount)}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const text = [
    "Thank you for your HolyHub order.",
    "This email records your order and the information that applies to it. Products are supplied and sold by the named seller(s), while HolyHub provides the marketplace, checkout and support experience.",
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
    "Cancellations, returns and refunds",
    "For most eligible goods bought online, you can normally tell the seller that you want to cancel within 14 days after receiving the goods. You then normally have a further 14 days to return them. Exceptions can apply, including certain personalised or custom-made goods, perishable items and sealed hygiene goods once unsealed. Your rights for faulty or misdescribed goods are not reduced.",
    "For a change-of-mind return, you may be responsible for the direct return cost where this was made clear before purchase. A valid cancellation refund includes the standard delivery amount where applicable, and the law may allow the refund to be held until the goods are returned or evidence of return is supplied.",
    "Physical returns normally go to the seller who supplied the product. Do not send returns to HolyHub unless HolyHub specifically tells you to do so.",
    "",
    cancellationFormText(),
    "",
    "Need help? Contact HolyHub at Official.holyhub@gmail.com and include your order reference and the seller/product involved.",
  ].join("\n");

  const htmlSellers = input.sellers.map((seller, index) => {
    const tradingName = seller.sellerBusinessName === seller.sellerLegalName
      ? seller.sellerLegalName
      : `${seller.sellerBusinessName} (legal name: ${seller.sellerLegalName})`;
    const items = seller.items.map(item => `<li>${escapeHtml(item.productName)} × ${item.quantity} — ${escapeHtml(formatMoney(item.lineTotal))} (${escapeHtml(formatMoney(item.unitAmount))} each)</li>`).join("");
    const telephone = seller.sellerTelephone ? `<p><strong>Seller telephone:</strong> ${escapeHtml(seller.sellerTelephone)}</p>` : "";
    return `<section><h3>Seller ${index + 1}: ${escapeHtml(tradingName)}</h3><p><strong>Seller address:</strong> ${escapeHtml(formatAddress(seller.sellerGeographicalAddress))}</p><p><strong>Seller email:</strong> ${escapeHtml(seller.sellerContactEmail)}</p>${telephone}<ul>${items}</ul><p><strong>Delivery:</strong> ${escapeHtml(seller.deliveryTerms)}</p><p><strong>Delivery charge:</strong> ${escapeHtml(formatMoney(seller.deliveryAmount))}</p></section>`;
  }).join("");

  const html = `<main><h1>HolyHub order confirmation</h1><p>Thank you for your HolyHub order.</p><p>This email records your order and the information that applies to it. Products are supplied and sold by the named seller(s), while HolyHub provides the marketplace, checkout and support experience.</p><p><strong>Order reference:</strong> ${escapeHtml(input.orderId)}</p><p><strong>Order date:</strong> ${escapeHtml(orderDate)}</p><p><strong>Delivery address:</strong> ${escapeHtml(formatAddress(input.deliveryAddress))}</p>${htmlSellers}<h3>Order total</h3><p>Products subtotal: ${escapeHtml(formatMoney(input.productSubtotal))}<br>Delivery total: ${escapeHtml(formatMoney(input.deliveryTotal))}<br><strong>Total paid: ${escapeHtml(formatMoney(input.totalAmount))}</strong></p><h3>Cancellations, returns and refunds</h3><p>For most eligible goods bought online, you can normally tell the seller that you want to cancel within 14 days after receiving the goods. You then normally have a further 14 days to return them. Exceptions can apply, including certain personalised or custom-made goods, perishable items and sealed hygiene goods once unsealed. Your rights for faulty or misdescribed goods are not reduced.</p><p>For a change-of-mind return, you may be responsible for the direct return cost where this was made clear before purchase. A valid cancellation refund includes the standard delivery amount where applicable, and the law may allow the refund to be held until the goods are returned or evidence of return is supplied.</p><p>Physical returns normally go to the seller who supplied the product. Do not send returns to HolyHub unless HolyHub specifically tells you to do so.</p><h3>Model cancellation form</h3><p>Use only if you wish to cancel an eligible contract; using this form is not obligatory.</p><p>To: [seller legal name and geographical address shown above for the relevant item]</p><p>I/We hereby give notice that I/We cancel my/our contract of sale of the following goods:<br>[Goods]<br>Ordered on / received on:<br>Name of consumer(s):<br>Address of consumer(s):<br>Signature of consumer(s) (only if this form is notified on paper):<br>Date:</p><p>Need help? Contact HolyHub at <a href="mailto:Official.holyhub@gmail.com">Official.holyhub@gmail.com</a> and include your order reference and the seller/product involved.</p></main>`;

  return {
    ok: true,
    idempotencyKey: orderConfirmationIdempotencyKey(input.orderId),
    subject: `HolyHub order confirmation — ${input.orderId}`,
    text,
    html,
  };
}
