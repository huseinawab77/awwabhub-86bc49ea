import { describe, expect, it } from "vitest";
import { isInterrupted, minutesForActivity, sessionSeconds, summarize, defaultFocusCategories, type FocusSession } from "./focus";

const base = (o: Partial<FocusSession>): FocusSession => ({
  id: "a", categoryId: "focus-deep", title: "", notes: "", startedAt: "2026-10-12T08:00:00", endedAt: null, pauses: [], status: "COMPLETED",
  durationSeconds: 0, goalId: null, projectId: null, milestoneId: null, plannerItemId: null, createdAt: "", updatedAt: "", ...o,
});

describe("focus", () => {
  it("excludes paused time", () => {
    const s = base({ endedAt: "2026-10-12T09:00:00", pauses: [{ start: "2026-10-12T08:20:00", end: "2026-10-12T08:30:00" }] });
    expect(sessionSeconds(s, 0)).toBe(50 * 60);
  });
  it("counts running session from timestamps, open pause stops the clock", () => {
    const s = base({ status: "PAUSED", pauses: [{ start: "2026-10-12T08:10:00", end: null }] });
    expect(sessionSeconds(s, Date.parse("2026-10-12T10:00:00"))).toBe(600);
  });
  it("aggregates completed only, by category and day", () => {
    const list = [base({ id: "1", durationSeconds: 600 }), base({ id: "2", durationSeconds: 1200, categoryId: "focus-study" }), base({ id: "3", durationSeconds: 999, status: "CANCELLED" })];
    const sum = summarize(list, "2026-10-12", "2026-10-18");
    expect(sum.totalSeconds).toBe(1800);
    expect(sum.count).toBe(2);
    expect(sum.byCategory["focus-deep"]).toBe(600);
    expect(minutesForActivity(list, defaultFocusCategories(""), "2026-10-12", "deep_work")).toBe(10);
  });
  it("flags long-running sessions as interrupted", () => {
    expect(isInterrupted(base({ status: "RUNNING" }), Date.parse("2026-10-13T09:00:00"))).toBe(true);
    expect(isInterrupted(base({ status: "RUNNING" }), Date.parse("2026-10-12T10:00:00"))).toBe(false);
  });
});
