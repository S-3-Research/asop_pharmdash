/**
 * Shared helpers for formatting WHOIS-sourced geo location strings
 * (city/state/country) for display. Used by both the Domain Map tooltip
 * (heatmap-map-client.tsx) and Domain Samples' collapsed-row location line
 * (domain-examples-card.tsx) so both surfaces treat privacy-redaction
 * placeholders and inconsistent casing the same way.
 */

// WHOIS "city"/"state"/"country" values are frequently a privacy-service
// placeholder rather than a real location (confirmed against a real
// production release: over half of all domains had a `city` value matching
// one of these patterns — e.g. "N/a", "REDACTED FOR PRIVACY", "DATA
// REDACTED", "Not Disclosed", "Personal data, can not be publicly
// disclosed according to applicable laws"). The same placeholder patterns
// can appear in `state`/`country` too, so this check applies to any of the
// three fields. Showing these verbatim is misleading, so we detect them and
// fall back to a generic "Approximate Location" label instead.
const ANOMALOUS_LOCATION_PATTERNS = [
  /redacted/i,
  /disclos/i, // "Not Disclosed", "...can not be publicly disclosed..."
  /^n\/?a$/i, // "N/a", "NA", "N/A"
  /^none$/i,
  /^unknown$/i,
  /^-+$/,
];

/** True when a raw city/state/country value looks like a WHOIS
 *  privacy-redaction placeholder rather than a real location value. */
export function isAnomalousLocationValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return ANOMALOUS_LOCATION_PATTERNS.some((re) => re.test(trimmed));
}

/** @deprecated alias of isAnomalousLocationValue, kept for clarity at
 *  city-specific call sites. */
export const isAnomalousCity = isAnomalousLocationValue;

export function titleCase(value: string): string {
  return value.replace(
    /\S+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

/** City value to actually render: real city names are title-cased for
 *  consistent display (source data has inconsistent casing, e.g. "SAN
 *  MATEO", "philadelphia"); WHOIS-privacy placeholders are replaced with a
 *  generic, honest label instead of shown verbatim. */
export function formatCityDisplay(city: string): string {
  if (isAnomalousLocationValue(city)) return "Approximate Location";
  return titleCase(city.trim());
}

/**
 * Builds the most precise displayable location string available for a
 * domain, given its raw city/state/country fields — used wherever we want
 * a single "best we have" address line (e.g. Domain Samples' collapsed
 * row) rather than the Domain Map tooltip's dedicated city-only display.
 *
 * Falls back down the precision ladder (city -> state -> country) whenever
 * a more precise field is missing or looks like a WHOIS privacy-redaction
 * placeholder. City is title-cased (e.g. "SAN MATEO" -> "San Mateo"); state
 * is upper-cased (state values here are short codes/abbreviations, e.g.
 * "ca" / "Ca" -> "CA"). Returns an empty string (not the "Approximate
 * Location" placeholder) when NONE of city/state/country yield anything
 * usable — callers should simply omit the address line in that case rather
 * than show a fake-precision placeholder.
 */
export function formatBestLocation(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined,
): string {
  const parts: string[] = [];
  const cityUsable = !!city && !isAnomalousLocationValue(city);
  if (cityUsable) parts.push(titleCase(city!.trim()));
  const stateUsable = !!state && state.trim() && !isAnomalousLocationValue(state);
  if (stateUsable) parts.push(state!.trim().toUpperCase());
  const countryUsable = !!country && country.trim() && !isAnomalousLocationValue(country);
  if (countryUsable) parts.push(country!.trim());
  return parts.join(", ");
}

/** Human-readable label for the `address_source` field (new in the
 *  2026-09-02 schema) — whether the reported address came from WHOIS
 *  registrant data or was scraped from the domain's website. Returns an
 *  empty string when the release didn't report a source, so callers can
 *  simply omit the annotation rather than show a fake-precision label. */
export function formatAddressSource(
  source: "whois" | "web" | null | undefined,
): string {
  if (source === "whois") return "WHOIS";
  if (source === "web") return "Website";
  return "";
}

