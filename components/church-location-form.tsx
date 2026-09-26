"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ChurchLocation, ChurchPlaceSuggestion } from "@/lib/church-places";
import type { ChurchProfileFormState } from "@/app/churches/profile/actions";
import styles from "./church-location-form.module.css";

type ChurchLocationFormProps = {
  action: (state: ChurchProfileFormState, formData: FormData) => Promise<ChurchProfileFormState>;
  initialLocation: ChurchLocation | null;
  locatorAvailable: boolean;
  isDevelopment: boolean;
};

const initialState: ChurchProfileFormState = { error: "" };
const emptyLocation: ChurchLocation = {
  churchName: "",
  formattedAddress: "",
  postcode: "",
  city: "",
  country: "United Kingdom",
  latitude: null,
  longitude: null,
  googlePlaceId: null,
  placeTypes: [],
};

export function ChurchLocationForm({ action, initialLocation, locatorAvailable, isDevelopment }: ChurchLocationFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [location, setLocation] = useState<ChurchLocation | null>(initialLocation?.googlePlaceId ? initialLocation : null);
  const [manual, setManual] = useState<ChurchLocation>(initialLocation ?? emptyLocation);
  const [manualMode, setManualMode] = useState(!locatorAvailable || Boolean(initialLocation && !initialLocation.googlePlaceId));
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ChurchPlaceSuggestion[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searchPending, setSearchPending] = useState(false);
  const [detailsPending, setDetailsPending] = useState(false);
  const sessionToken = useRef<string | null>(null);

  useEffect(() => {
    if (!locatorAvailable || manualMode || location || query.trim().length < 3) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchPending(true);
      setSearchError("");
      sessionToken.current ??= window.crypto.randomUUID();
      try {
        const response = await fetch("/api/church-locator/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: query.trim(), sessionToken: sessionToken.current }),
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.available) {
          setSearchError("Church search is unavailable. Enter your church details below.");
          return;
        }
        setSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSearchError("Church search is unavailable. Enter your church details below.");
      } finally {
        if (!controller.signal.aborted) setSearchPending(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locatorAvailable, location, manualMode, query]);

  async function selectSuggestion(suggestion: ChurchPlaceSuggestion) {
    sessionToken.current ??= window.crypto.randomUUID();
    setDetailsPending(true);
    setSearchError("");
    try {
      const response = await fetch("/api/church-locator/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: suggestion.placeId, sessionToken: sessionToken.current }),
      });
      const result = await response.json();
      if (!response.ok || !result.location) {
        setSearchError("We couldn't load that church. Please choose another result or enter it manually.");
        return;
      }

      const selected = result.location as ChurchLocation;
      setLocation(selected);
      setManual(selected);
      setQuery("");
      setSuggestions([]);
      sessionToken.current = null;
    } catch {
      setSearchError("We couldn't load that church. Please choose another result or enter it manually.");
    } finally {
      setDetailsPending(false);
    }
  }

  function switchToManual() {
    setManual(location ?? manual);
    setLocation(null);
    setManualMode(true);
    setSuggestions([]);
    setSearchPending(false);
  }

  function changeSelection() {
    setLocation(null);
    setManualMode(false);
    setQuery("");
    sessionToken.current = null;
  }

  function updateManual(field: keyof ChurchLocation, value: string) {
    setManual((current) => ({ ...current, [field]: value, googlePlaceId: null, placeTypes: [], latitude: null, longitude: null }));
  }

  return (
    <form className="form" action={formAction}>
      {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
      <section className={styles.locationSection} aria-labelledby="church-location-title">
        <div>
          <h2 id="church-location-title">Find your church</h2>
          <p className={styles.helper}>Start typing your church name or postcode.</p>
        </div>
        {!locatorAvailable && (
          <p className={styles.notice} role="status">
            {isDevelopment
              ? "Church search is unavailable because GOOGLE_PLACES_API_KEY is not configured. You can enter the location manually."
              : "Church search is unavailable right now. You can enter the location manually."}
          </p>
        )}

        {!manualMode && !location && locatorAvailable && (
          <div className={styles.searchField}>
            <label className="sr-only" htmlFor="church-search">Find your church</label>
            <input id="church-search" type="search" autoComplete="off" value={query} onChange={(event) => {
              const value = event.currentTarget.value;
              setQuery(value);
              setSuggestions([]);
              setSearchPending(false);
              setSearchError("");
            }} placeholder="Church name or postcode" />
            {query.trim().length > 0 && query.trim().length < 3 && <p className={styles.helper}>Enter at least 3 characters to search.</p>}
            {searchPending && <p className={styles.status} role="status">Searching churches...</p>}
            {searchError && <p className={styles.error} role="alert">{searchError}</p>}
            {suggestions.length > 0 && (
              <>
                <ul className={styles.suggestions} aria-label="Church suggestions">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.placeId}>
                      <button type="button" onClick={() => void selectSuggestion(suggestion)} disabled={detailsPending}>
                        <strong>{suggestion.churchName}</strong>
                        <span>{suggestion.address}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {/* Required Google Maps attribution for Places results displayed without a map. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.googleAttribution} src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google Maps" width="120" height="14" />
              </>
            )}
            {detailsPending && <p className={styles.status} role="status">Loading church details...</p>}
            <button className={styles.manualLink} type="button" onClick={switchToManual}>Can&apos;t find your church? Enter details manually.</button>
          </div>
        )}

        {location && !manualMode && (
          <div className={styles.confirmation}>
            <p className={styles.question}>Is this the right church?</p>
            <strong>{location.churchName}</strong>
            <span>{location.formattedAddress}</span>
            {location.googlePlaceId && (
              <>
                {/* Required Google Maps attribution for selected Places content displayed without a map. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.googleAttribution} src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google Maps" width="120" height="14" />
              </>
            )}
            {locatorAvailable && <button className={styles.manualLink} type="button" onClick={changeSelection}>Choose a different church</button>}
            <button className={styles.manualLink} type="button" onClick={switchToManual}>Can&apos;t find your church? Enter details manually.</button>
          </div>
        )}

        {manualMode && (
          <div className={styles.manualFields}>
            <div className="field">
              <label htmlFor="manual_church_name">Church name</label>
              <input id="manual_church_name" name="church_name" value={manual.churchName} onChange={(event) => updateManual("churchName", event.currentTarget.value)} maxLength={200} required />
            </div>
            <div className="field">
              <label htmlFor="manual_church_address">Address</label>
              <textarea id="manual_church_address" name="formatted_address" value={manual.formattedAddress} onChange={(event) => updateManual("formattedAddress", event.currentTarget.value)} maxLength={500} rows={3} required />
            </div>
            <div className={styles.manualRow}>
              <div className="field">
                <label htmlFor="manual_church_postcode">Postcode</label>
                <input id="manual_church_postcode" name="postcode" value={manual.postcode} onChange={(event) => updateManual("postcode", event.currentTarget.value)} maxLength={30} />
              </div>
              <div className="field">
                <label htmlFor="manual_church_city">Town / city</label>
                <input id="manual_church_city" name="city" value={manual.city} onChange={(event) => updateManual("city", event.currentTarget.value)} maxLength={120} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="manual_church_country">Country</label>
              <input id="manual_church_country" name="country" value={manual.country} onChange={(event) => updateManual("country", event.currentTarget.value)} maxLength={100} required />
            </div>
            {location && <button className={styles.manualLink} type="button" onClick={() => { setManualMode(false); setLocation(null); }}>Search for a church instead</button>}
          </div>
        )}

        {location && !manualMode && (
          <>
            <input type="hidden" name="church_name" value={location.churchName} />
            <input type="hidden" name="formatted_address" value={location.formattedAddress} />
            <input type="hidden" name="postcode" value={location.postcode} />
            <input type="hidden" name="city" value={location.city} />
            <input type="hidden" name="country" value={location.country} />
            <input type="hidden" name="latitude" value={location.latitude ?? ""} />
            <input type="hidden" name="longitude" value={location.longitude ?? ""} />
            <input type="hidden" name="google_place_id" value={location.googlePlaceId ?? ""} />
            <input type="hidden" name="place_types" value={JSON.stringify(location.placeTypes)} />
          </>
        )}
        {manualMode && <input type="hidden" name="google_place_id" value="" />}
      </section>
      <button className="button button-primary" type="submit" disabled={isPending || detailsPending}>{isPending ? "Saving church location..." : "Save church location"}</button>
    </form>
  );
}