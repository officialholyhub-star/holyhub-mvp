export type ChurchLocation = {
  churchName: string;
  formattedAddress: string;
  postcode: string;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  placeTypes: string[];
};

export type ChurchPlaceSuggestion = {
  placeId: string;
  churchName: string;
  address: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  const item = record(value);
  return typeof item?.text === "string" ? item.text.trim() : "";
}

export function isPlacesConfigured(apiKey: string | undefined | null) {
  return Boolean(apiKey?.trim());
}

export function mapChurchSuggestions(payload: unknown): ChurchPlaceSuggestion[] {
  const predictions = record(payload)?.suggestions;
  if (!Array.isArray(predictions)) return [];

  return predictions.flatMap((item): ChurchPlaceSuggestion[] => {
    const place = record(record(item)?.placePrediction);
    const placeId = place?.placeId;
    const types = place?.types;
    if (typeof placeId !== "string" || !Array.isArray(types) || !types.includes("church")) return [];

    const format = record(place?.structuredFormat);
    const churchName = text(format?.mainText) || text(place?.text);
    const address = text(format?.secondaryText) || text(place?.text);
    return churchName && address ? [{ placeId, churchName, address }] : [];
  });
}

function componentText(components: unknown, type: string, field: "longText" | "shortText" = "longText") {
  if (!Array.isArray(components)) return "";
  const match = components.map(record).find((component) => {
    return Array.isArray(component?.types) && component.types.includes(type);
  });
  const value = match?.[field];
  return typeof value === "string" ? value : "";
}

export function mapChurchPlaceDetails(payload: unknown, fallbackPlaceId = ""): ChurchLocation | null {
  const place = record(payload);
  const churchName = text(place?.displayName);
  const formattedAddress = typeof place?.formattedAddress === "string" ? place.formattedAddress.trim() : "";
  const location = record(place?.location);
  const latitude = typeof location?.latitude === "number" && Number.isFinite(location.latitude) ? location.latitude : null;
  const longitude = typeof location?.longitude === "number" && Number.isFinite(location.longitude) ? location.longitude : null;
  const types = Array.isArray(place?.types) ? place.types.filter((type): type is string => typeof type === "string") : [];

  if (!churchName || !formattedAddress) return null;

  return {
    churchName,
    formattedAddress,
    postcode: componentText(place?.addressComponents, "postal_code"),
    city: componentText(place?.addressComponents, "postal_town") || componentText(place?.addressComponents, "locality") || componentText(place?.addressComponents, "administrative_area_level_2"),
    country: componentText(place?.addressComponents, "country"),
    latitude,
    longitude,
    googlePlaceId: typeof place?.id === "string" ? place.id : fallbackPlaceId,
    placeTypes: types,
  };
}

export function mapManualChurchLocation(input: {
  churchName: string;
  formattedAddress: string;
  postcode: string;
  city: string;
  country: string;
}): ChurchLocation | null {
  const churchName = input.churchName.trim();
  const formattedAddress = input.formattedAddress.trim();
  const postcode = input.postcode.trim();
  const city = input.city.trim();
  const country = input.country.trim();

  if (!churchName || churchName.length > 200 || !formattedAddress || formattedAddress.length > 500 || postcode.length > 30 || city.length > 120 || !country || country.length > 100) {
    return null;
  }

  return {
    churchName,
    formattedAddress,
    postcode,
    city,
    country,
    latitude: null,
    longitude: null,
    googlePlaceId: null,
    placeTypes: [],
  };
}