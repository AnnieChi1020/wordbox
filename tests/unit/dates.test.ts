import { describe, expect, it } from "vitest"

import { isValidTimeZone } from "@/lib/domain/dates"

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
