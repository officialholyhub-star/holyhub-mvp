import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlacesConfigured,
  mapChurchPlaceDetails,
  mapChurchSuggestions,
  mapManualChurchLocation,
} from "../lib/church-places.ts";

test("maps church suggestions and filters unrelated places", () => {
  const suggestions = mapChurchSuggestions({
    suggestions: [
      {
        placePrediction: {
          placeId: "church-1",
          types: ["church", "place_of_worship"],
          text: { text: "St Mark's Church, London" },
          structuredFormat: {
            mainText: { text: "St Mark's Church" },
            secondaryText: { text: "London" },
          },
        },
      },
      {
        placePrediction: {
          placeId: "cafe-1",
          types: ["cafe", "establishment"],
          text: { text: "Church Cafe, London" },
        },
      },
    ],
  });

  assert.deepEqual(suggestions, [{ placeId: "church-1", churchName: "St Mark's Church", address: "London" }]);
});

test("maps place details into saved church location fields", () => {
  const location = mapChurchPlaceDetails({
    id: "google-place-1",
    displayName: { text: "St Mark's Church" },
    formattedAddress: "1 Church Road, London SW1A 1AA, UK",
    addressComponents: [
      { longText: "SW1A 1AA", types: ["postal_code"] },
      { longText: "London", types: ["postal_town"] },
      { longText: "United Kingdom", shortText: "GB", types: ["country"] },
    ],
    location: { latitude: 51.5, longitude: -0.12 },
    types: ["church", "place_of_worship"],
  });

  assert.equal(location?.churchName, "St Mark's Church");
  assert.equal(location?.postcode, "SW1A 1AA");
  assert.equal(location?.city, "London");
  assert.equal(location?.country, "United Kingdom");
  assert.equal(location?.googlePlaceId, "google-place-1");
  assert.deepEqual([location?.latitude, location?.longitude], [51.5, -0.12]);
});

test("missing Places key disables search without blocking manual locations", () => {
  assert.equal(isPlacesConfigured(undefined), false);
  assert.equal(isPlacesConfigured("  "), false);
  assert.equal(isPlacesConfigured("server-key"), true);

  assert.deepEqual(mapManualChurchLocation({
    churchName: "Grace Church",
    formattedAddress: "10 High Street",
    postcode: "AB1 2CD",
    city: "Bristol",
    country: "United Kingdom",
  }), {
    churchName: "Grace Church",
    formattedAddress: "10 High Street",
    postcode: "AB1 2CD",
    city: "Bristol",
    country: "United Kingdom",
    latitude: null,
    longitude: null,
    googlePlaceId: null,
    placeTypes: [],
  });
});