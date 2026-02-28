/**
 * ET (Eastern Time / America/New_York) date utilities.
 * The server runs in UTC; these helpers ensure dates/timestamps are
 * formatted in Eastern Time.
 */

/** Returns today's date string "YYYY-MM-DD" in Eastern Time. */
export function getETDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Returns a Date whose getFullYear/getMonth/getDate reflect the Eastern Time
 * calendar date for `d`.  Useful when passing a Date object to functions that
 * read its date components (e.g. plan matching, section extraction).
 */
export function getETDate(d: Date = new Date()): Date {
  const str = getETDateString(d); // "YYYY-MM-DD"
  const [y, m, day] = str.split("-").map(Number);
  // Construct as local midnight — date components equal the ET date
  return new Date(y, m - 1, day);
}

/**
 * Returns a formatted timestamp string "YYYY-MM-DD HH:MM" in Eastern Time.
 * Suitable for notes/logs.
 */
export function getETTimestamp(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
