/**
 * Returns the adjusted roll date for a given timestamp.
 * A "night" runs from 5:00 PM to 4:59 AM (America/New_York).
 * Rolls between midnight and 4:59 AM belong to the previous calendar date.
 */
export function getAdjustedRollDate(timestamp: Date): string {
  const nyHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(timestamp)
  );

  // Date string in NY timezone (YYYY-MM-DD via en-CA locale)
  const nyDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);

  if (nyHour < 5) {
    // Subtract one calendar day
    const [year, month, day] = nyDate.split("-").map(Number);
    const prev = new Date(year, month - 1, day - 1);
    return prev.toLocaleDateString("en-CA");
  }

  return nyDate;
}

/**
 * Returns the hour (0–23) in America/New_York for the given timestamp.
 */
export function getNYHour(timestamp: Date): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(timestamp)
  );
}
