/**
 * Timezone utilities for consistent Eastern Time conversion across the app.
 * Uses Intl.DateTimeFormat for DST-aware conversion (handles EST/EDT automatically).
 */

/**
 * Converts a UTC date to Eastern Time hour (0-23).
 * Automatically handles EST (UTC-5) vs EDT (UTC-4) based on the date.
 */
export function toEasternHour(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  });
  const hourStr = formatter.format(date);
  // Handle "24" which Intl returns for midnight in some locales
  const hour = parseInt(hourStr, 10);
  return hour === 24 ? 0 : hour;
}

/**
 * Converts a date string (ISO format) to Eastern Time hour.
 */
export function toEasternHourFromString(dateString: string): number {
  return toEasternHour(new Date(dateString));
}

/**
 * Business hours range for calling analytics (8 AM - 7 PM ET).
 */
export const BUSINESS_HOURS = {
  start: 8,  // 8 AM
  end: 19,   // 7 PM (inclusive, so 8-19 = 12 hours)
} as const;

/**
 * Array of business hours for iteration (8, 9, 10, ..., 19).
 */
export const BUSINESS_HOURS_ARRAY = Array.from(
  { length: BUSINESS_HOURS.end - BUSINESS_HOURS.start + 1 },
  (_, i) => BUSINESS_HOURS.start + i
);

/**
 * Check if an hour falls within business hours.
 */
export function isBusinessHour(hour: number): boolean {
  return hour >= BUSINESS_HOURS.start && hour <= BUSINESS_HOURS.end;
}

/**
 * Format hour for display (e.g., 8 -> "8a", 14 -> "2p").
 */
export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour > 12) return `${hour - 12}p`;
  return `${hour}a`;
}
