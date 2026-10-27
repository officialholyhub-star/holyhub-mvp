// MVP delivery territories: geographic postcode areas in England, Scotland and Wales.
// UK-shaped postcodes alone are insufficient (BT, Crown Dependencies and BFPO).
export const GB_DELIVERY_AREAS = new Set(`AB AL B BA BB BD BH BL BN BR BS CA CB CF CH CM CO CR CT CV CW DA DD DE DG DH DL DN DT DY E EC EH EN EX FK FY G GL GU HA HD HG HP HR HS HU HX IG IP IV KA KT KW KY L LA LD LE LL LN LS LU M ME MK ML N NE NG NN NP NR NW OL OX PA PE PH PL PO PR RG RH RM S SA SE SG SK SL SM SN SO SP SR SS ST SW SY TA TD TF TN TQ TR TS TW UB W WA WC WD WF WN WR WS WV YO ZE`.split(" "));
const postcodePattern = /^([A-PR-UWYZ][0-9](?:[0-9]|[A-HJKPSTUW])?|[A-PR-UWYZ][A-HK-Y][0-9](?:[0-9]|[ABEHMNPRVWXY])?)([0-9][ABD-HJLNP-UW-Z]{2})$/;
export const NI_DELIVERY_MESSAGE = "Northern Ireland delivery isn’t available yet.";

export function deliveryPostcode(value: string) {
  if (value.length > 12 || !/^[a-z0-9 ]+$/i.test(value)) return { territory: "invalid" as const };
  const compact = value.toUpperCase().replace(/ /g, "");
  const match = postcodePattern.exec(compact);
  if (!match) return { territory: "invalid" as const };
  const [, outward, inward] = match;
  const area = outward.match(/^[A-Z]+/)![0];
  const postcode = `${outward} ${inward}`;
  if (area === "BT") return { territory: "ni" as const, postcode, outward };
  return { territory: GB_DELIVERY_AREAS.has(area) ? "supported" as const : "unsupported" as const, postcode, outward };
}

// get() alone silently accepts the first of conflicting duplicate form fields.
export function singleText(data: FormData, name: string): string | null {
  const values = data.getAll(name);
  if (values.length !== 1 || typeof values[0] !== "string") return null;
  return values[0].trim();
}

export type DeliveryAddress = {
  delivery_recipient_name: string;
  delivery_address_line1: string;
  delivery_address_line2: string | null;
  delivery_city: string;
  delivery_postcode: string;
  delivery_country: "GB";
};

export function readDeliveryAddress(data: FormData): DeliveryAddress | null {
  const name = singleText(data, "delivery_recipient_name");
  const line1 = singleText(data, "delivery_address_line1");
  const line2 = data.has("delivery_address_line2") ? singleText(data, "delivery_address_line2") : "";
  const city = singleText(data, "delivery_city");
  const postcode = singleText(data, "delivery_postcode");
  if (singleText(data, "delivery_country") !== "GB" || name === null || line1 === null || line2 === null || city === null || postcode === null) return null;
  if (![name, line1, city].every(s => s.length > 0 && s.length <= 200 && !/[\x00-\x1f\x7f]/.test(s))
    || line2.length > 200 || /[\x00-\x1f\x7f]/.test(line2)) return null;
  const result = deliveryPostcode(postcode);
  if (result.territory !== "supported") return null;
  return { delivery_recipient_name: name, delivery_address_line1: line1, delivery_address_line2: line2 || null,
    delivery_city: city, delivery_postcode: result.postcode!, delivery_country: "GB" };
}
