import "server-only";

/**
 * A non-fatal caveat attached to widget data.
 *
 * Distinct from an error: the data IS present, it just cannot be read at face
 * value. The funnel's `truncated` flag is the reason this exists — a capped
 * contact fetch produced a confident-looking undercount that was
 * indistinguishable from a real reading.
 */
export type WidgetWarning = {
  code: "truncated" | "no_location" | "sample_data";
  message: string;
};

export const NO_LOCATION_WARNING: WidgetWarning = {
  code: "no_location",
  message:
    "No GHL location is configured for this account, so live figures are unavailable. " +
    "The values shown are sample data.",
};

export const TRUNCATED_FUNNEL_WARNING: WidgetWarning = {
  code: "truncated",
  message:
    "Incomplete data. The contact fetch hit its page limit, so every stage below is " +
    "an undercount rather than a total. Do not read these as final numbers.",
};

export const SAMPLE_DATA_WARNING: WidgetWarning = {
  code: "sample_data",
  message: "The figures shown are placeholders, not a reading.",
};
