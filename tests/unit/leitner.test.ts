import { describe, expect, it } from "vitest"

import { applyAnswer, intervalDays } from "@/lib/domain/leitner"

const TODAY = "2026-10-20"

describe("intervalDays (R7.4)", () => {
  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [3, 4, 2],
    [4, 8, 4],
    [5, 16, 8],
  ])("box %i: normal %i days, important %i days", (box, normal, important) => {
    expect(intervalDays(box, false)).toBe(normal)
    expect(intervalDays(box, true)).toBe(important)
  })

  it.each([-1, 6, 1.5])("rejects box %s", (box) => {
    expect(() => intervalDays(box, false)).toThrow(RangeError)
  })
})

describe("applyAnswer (R7.4)", () => {
  const due = (box: number, isImportant = false) => ({
    box,
    nextDueOn: TODAY,
    isImportant,
  })

  // R7.4 AC
  it("box 2, due, normal, correct → box 3, due in 4 days", () => {
    expect(applyAnswer(due(2), true, TODAY)).toEqual({
      box: 3,
      nextDueOn: "2026-10-24",
      wasDue: true,
    })
  })

  it("box 2, due, important, correct → box 3, due in 2 days", () => {
    expect(applyAnswer(due(2, true), true, TODAY)).toEqual({
      box: 3,
      nextDueOn: "2026-10-22",
      wasDue: true,
    })
  })

  it("box 5, due, correct → stays at box 5, due in 16 days", () => {
    expect(applyAnswer(due(5), true, TODAY)).toEqual({
      box: 5,
      nextDueOn: "2026-11-05",
      wasDue: true,
    })
  })

  it("box 4, wrong → box 0, due tomorrow (D16)", () => {
    expect(applyAnswer(due(4), false, TODAY)).toEqual({
      box: 0,
      nextDueOn: "2026-10-21",
      wasDue: true,
    })
  })

  it("not-due filler word answered correctly → unchanged (D3)", () => {
    const state = { box: 3, nextDueOn: "2026-10-23", isImportant: false }
    expect(applyAnswer(state, true, TODAY)).toEqual({
      box: 3,
      nextDueOn: "2026-10-23",
      wasDue: false,
    })
  })

  // 其他情況
  it("new word (box 0) answered correctly → box 1, due tomorrow", () => {
    expect(applyAnswer(due(0), true, TODAY)).toEqual({
      box: 1,
      nextDueOn: "2026-10-21",
      wasDue: true,
    })
  })

  it("new word (box 0) answered wrong → stays at box 0, due tomorrow", () => {
    expect(applyAnswer(due(0), false, TODAY)).toEqual({
      box: 0,
      nextDueOn: "2026-10-21",
      wasDue: true,
    })
  })

  it("not-due filler word answered wrong → box 0, due tomorrow", () => {
    const state = { box: 4, nextDueOn: "2026-10-25", isImportant: false }
    expect(applyAnswer(state, false, TODAY)).toEqual({
      box: 0,
      nextDueOn: "2026-10-21",
      wasDue: false,
    })
  })

  it("overdue word counts as due and schedules from today", () => {
    const state = { box: 1, nextDueOn: "2026-10-01", isImportant: false }
    expect(applyAnswer(state, true, TODAY)).toEqual({
      box: 2,
      nextDueOn: "2026-10-22",
      wasDue: true,
    })
  })
})
