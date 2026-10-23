import { addDays as addDaysToDate, format, isValid, parse } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"

const DATE_FORMAT = "yyyy-MM-dd"

/** The time zone used while profile.timezone is not initialized (design §4.4). */
export const FALLBACK_TIMEZONE = "UTC"

/** Whether this is an IANA time zone supported by Intl (e.g. `America/Boise`). */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Today in the user's time zone (rolling over at midnight, R8.6), as `YYYY-MM-DD`. */
export function localToday(
  timezone: string | null,
  now: Date = new Date(),
): string {
  return formatInTimeZone(now, timezone ?? FALLBACK_TIMEZONE, DATE_FORMAT)
}

/** Adds days to a date string; works on calendar dates only, unaffected by time zones and daylight saving time. */
export function addDays(date: string, n: number): string {
  const parsed = parse(date, DATE_FORMAT, new Date(2000, 0, 1, 12))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValid(parsed)) {
    throw new RangeError(`invalid date: ${date}`)
  }
  return format(addDaysToDate(parsed, n), DATE_FORMAT)
}
