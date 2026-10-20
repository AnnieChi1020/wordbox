import { addDays as addDaysToDate, format, isValid, parse } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"

const DATE_FORMAT = "yyyy-MM-dd"

/** profile.timezone 尚未初始化時使用的時區（design §4.4）。 */
export const FALLBACK_TIMEZONE = "UTC"

/** 是否為 Intl 支援的 IANA 時區（例：`America/Boise`）。 */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** 使用者時區的今天（午夜換日，R8.6），格式 `YYYY-MM-DD`。 */
export function localToday(
  timezone: string | null,
  now: Date = new Date(),
): string {
  return formatInTimeZone(now, timezone ?? FALLBACK_TIMEZONE, DATE_FORMAT)
}

/** 日期字串加減天數；只處理日曆日期，不受時區與夏令時間影響。 */
export function addDays(date: string, n: number): string {
  const parsed = parse(date, DATE_FORMAT, new Date(2000, 0, 1, 12))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValid(parsed)) {
    throw new RangeError(`invalid date: ${date}`)
  }
  return format(addDaysToDate(parsed, n), DATE_FORMAT)
}
