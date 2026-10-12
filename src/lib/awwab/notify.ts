// Notifications & alarms. Device-local settings (localStorage), in-tab scheduler only.
// Reminders never write entries or feed calc.ts.
import { useEffect, useState } from "react";

export interface NotifySettings {
  enabled: boolean;
  sound: boolean;
  habitTime: string | null; // HH:MM daily tracker reminder
  agendaLead: number; // minutes before planner/routine items
  focusMinutes: number | null; // alarm after N focused minutes
}
const KEY = "awwab.notify.v1";
const FIRED = "awwab.notify.fired";
export const DEFAULT_NOTIFY: NotifySettings = { enabled: false, sound: true, habitTime: "20:00", agendaLead: 10, focusMinutes: 25 };

export function loadNotify(): NotifySettings {
  try { return { ...DEFAULT_NOTIFY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULT_NOTIFY; }
}
const subs = new Set<() => void>();
export function saveNotify(s: NotifySettings) { localStorage.setItem(KEY, JSON.stringify(s)); subs.forEach((f) => f()); }
export function useNotifySettings(): NotifySettings {
  const [s, set] = useState(DEFAULT_NOTIFY);
  useEffect(() => { const f = () => set(loadNotify()); f(); subs.add(f); return () => { subs.delete(f); }; }, []);
  return s;
}

export const notifySupported = () => typeof window !== "undefined" && "Notification" in window;
export async function requestPermission() {
  if (!notifySupported()) return "unsupported";
  return Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
}

let ctx: AudioContext | null = null;
export function chime() {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    [660, 880, 1320].forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = t0 + i * 0.35;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      o.connect(g).connect(ctx!.destination); o.start(t); o.stop(t + 1.3);
    });
  } catch { /* audio blocked */ }
}

/** Fire once per key (persisted so refreshes don't repeat). */
export function fireOnce(key: string, title: string, body: string, sound: boolean) {
  let fired: string[] = [];
  try { fired = JSON.parse(localStorage.getItem(FIRED) ?? "[]"); } catch { /* */ }
  if (fired.includes(key)) return false;
  localStorage.setItem(FIRED, JSON.stringify([key, ...fired].slice(0, 300)));
  if (sound) chime();
  if (notifySupported() && Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "/favicon.svg", tag: key }); } catch { /* */ }
  }
  return true;
}

export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
