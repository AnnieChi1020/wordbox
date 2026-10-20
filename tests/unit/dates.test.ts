import { afterEach, describe, expect, it } from "vitest"

import { addDays, isValidTimeZone, localToday } from "@/lib/domain/dates"

describe("isValidTimeZone", () => {
  it.each(["America/Boise", "Asia/Taipei", "UTC", "Europe/London"])(
    "accepts %s",
    (tz) => expect(isValidTimeZone(tz)).toBe(true),
  )

  it.each([undefined, null, 42, "", "Mars/Olympus", "Asia/Taipei; drop table"])(
    "rejects %s",
    (tz) => expect(isValidTimeZone(tz)).toBe(false),
  )
})

describe("localToday (R8.6)", () => {
  // 2026-10-21 06:30 UTC = 台北 14:30 (10/21) = Boise 00:30 (10/21, MDT)
  const instant = new Date("2026-10-21T06:30:00Z")

  it("uses the user's time zone", () => {
    expect(localToday("Asia/Taipei", instant)).toBe("2026-10-21")
    expect(localToday("America/Boise", instant)).toBe("2026-10-21")
    expect(localToday("Pacific/Honolulu", instant)).toBe("2026-10-20")
  })

  it("changes date at local midnight", () => {
    expect(localToday("America/Boise", new Date("2026-10-21T05:59:59Z"))).toBe(
      "2026-10-20",
    )
    expect(localToday("America/Boise", new Date("2026-10-21T06:00:00Z"))).toBe(
      "2026-10-21",
    )
  })

  it("falls back to UTC when the profile has no time zone", () => {
    expect(localToday(null, new Date("2026-10-20T23:59:59Z"))).toBe(
      "2026-10-20",
    )
  })
})

describe("addDays", () => {
  const originalTz = process.env.TZ
  afterEach(() => {
    process.env.TZ = originalTz
  })

  it.each([
    ["2026-10-20", 1, "2026-10-21"],
    ["2026-10-20", 16, "2026-11-05"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2027-02-28", 1, "2027-03-01"],
    ["2026-10-20", 0, "2026-10-20"],
    ["2026-03-01", -1, "2026-02-28"],
  ])("%s + %i = %s", (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected)
  })

  // 伺服器時區有夏令時間時也只做日曆運算
  it.each(["America/Boise", "America/Santiago", "Asia/Taipei", "UTC"])(
    "is unaffected by DST when the process runs in %s",
    (tz) => {
      process.env.TZ = tz
      expect(addDays("2026-03-07", 1)).toBe("2026-03-08") // 美國 DST 開始前
      expect(addDays("2026-03-08", 1)).toBe("2026-03-09")
      expect(addDays("2026-10-31", 2)).toBe("2026-11-02") // 美國 DST 結束
      expect(addDays("2026-11-01", 16)).toBe("2026-11-17")
      expect(addDays("2026-09-05", 1)).toBe("2026-09-06") // 智利 DST：當地沒有 00:00
      expect(addDays("2026-09-06", 1)).toBe("2026-09-07")
    },
  )

  it.each(["2026-13-01", "2026-02-30", "20261020", "", "2026-1-5"])(
    "rejects invalid date %j",
    (date) => expect(() => addDays(date, 1)).toThrow(RangeError),
  )
})
