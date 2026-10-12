// Focus Hub: pure derivations. Reference only — never imported by calc.ts, never writes entries.
import { addDays, datesBetween, toKey } from "./dates";

export type FocusStatus = "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
export interface FocusPause { start: string; end: string | null }
export interface FocusCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
  defaultTargetMinutes: number | null; // per day, optional
  activityId: string | null; // reference hint in Daily Tracker only
  goalId: string | null;
  projectId: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface FocusSession {
  id: string;
  categoryId: string;
  title: string;
  notes: string;
  startedAt: string;
  endedAt: string | null;
  pauses: FocusPause[];
  status: FocusStatus;
  durationSeconds: number; // cache; always recomputed from timestamps on finish/edit
  goalId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  plannerItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const FOCUS_COLORS = ["#C99286", "#F1A261", "#242139", "#77716B", "#8FA68E", "#7C93B5"];
export const INTERRUPT_HOURS = 12;

export function defaultFocusCategories(at: string): FocusCategory[] {
  const mk = (id: string, name: string, color: string, activityId: string, i: number): FocusCategory => ({
    id, name, description: "", color, sortOrder: i, defaultTargetMinutes: null, activityId, goalId: null, projectId: null, isActive: true, archivedAt: null, createdAt: at, updatedAt: at,
  });
  return [mk("focus-study", "Study Session", "#C99286", "study_session", 0), mk("focus-deep", "Deep Work", "#242139", "deep_work", 1), mk("focus-skill", "Skill Development", "#F1A261", "skill_dev", 2)];
}

const ms = (iso: string) => new Date(iso).getTime();

/** Net focus seconds = (end − start) − paused time, with pauses clipped to the session window. */
export function sessionSeconds(s: Pick<FocusSession, "startedAt" | "endedAt" | "pauses">, nowMs: number): number {
  const start = ms(s.startedAt);
  const end = s.endedAt ? ms(s.endedAt) : nowMs;
  if (!(end > start)) return 0;
  let paused = 0;
  for (const p of s.pauses) {
    const ps = Math.max(start, ms(p.start));
    const pe = Math.min(end, p.end ? ms(p.end) : end);
    if (pe > ps) paused += pe - ps;
  }
  return Math.max(0, Math.floor((end - start - paused) / 1000));
}

export const activeSession = (sessions: FocusSession[]) => sessions.find((s) => s.status === "RUNNING" || s.status === "PAUSED") ?? null;

export const isInterrupted = (s: FocusSession, nowMs: number) =>
  (s.status === "RUNNING" || s.status === "PAUSED") && nowMs - ms(s.startedAt) > INTERRUPT_HOURS * 3600_000;

/** Completed sessions only; attributed to the local date they started. */
export const sessionDate = (s: FocusSession) => toKey(new Date(s.startedAt));
export const completed = (sessions: FocusSession[]) => sessions.filter((s) => s.status === "COMPLETED");

export interface FocusSummary { totalSeconds: number; count: number; avgSeconds: number; byCategory: Record<string, number>; byDay: { date: string; seconds: number }[] }
export function summarize(sessions: FocusSession[], start: string, end: string): FocusSummary {
  const days = datesBetween(start, end);
  const byDayMap: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  const byCategory: Record<string, number> = {};
  let total = 0, count = 0;
  for (const s of completed(sessions)) {
    const d = sessionDate(s);
    if (d < start || d > end) continue;
    total += s.durationSeconds; count++;
    byDayMap[d] = (byDayMap[d] ?? 0) + s.durationSeconds;
    byCategory[s.categoryId] = (byCategory[s.categoryId] ?? 0) + s.durationSeconds;
  }
  return { totalSeconds: total, count, avgSeconds: count ? Math.round(total / count) : 0, byCategory, byDay: days.map((date) => ({ date, seconds: byDayMap[date] ?? 0 })) };
}

/** Reference minutes on a date for categories linked to an activity (Daily Tracker hint). */
export function minutesForActivity(sessions: FocusSession[], categories: FocusCategory[], date: string, activityId: string): number {
  const ids = new Set(categories.filter((c) => c.activityId === activityId).map((c) => c.id));
  if (!ids.size) return 0;
  const sec = completed(sessions).filter((s) => ids.has(s.categoryId) && sessionDate(s) === date).reduce((a, s) => a + s.durationSeconds, 0);
  return Math.round(sec / 60);
}

export const fmtClock = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${h > 0 ? `${h}:` : ""}${p(m)}:${p(s)}`;
};
export const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}j ${m}m` : `${m}m`;
};
export { addDays };
