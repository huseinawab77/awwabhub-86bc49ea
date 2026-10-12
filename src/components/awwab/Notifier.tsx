import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { getState } from "@/lib/awwab/store";
import { itemsOn } from "@/lib/awwab/planner";
import { activeOn, occurrencesIn } from "@/lib/awwab/routines";
import { activeSession, sessionSeconds } from "@/lib/awwab/focus";
import { toKey } from "@/lib/awwab/dates";
import { useLang } from "@/lib/awwab/i18n";
import { chime, DEFAULT_NOTIFY, fireOnce, notifySupported, requestPermission, saveNotify, toMin, useNotifySettings, loadNotify } from "@/lib/awwab/notify";

/** In-tab scheduler: checks every 20s while AWWAB is open. */
export function Notifier() {
  const s = useNotifySettings();
  const id = useLang() === "id";
  const ref = useRef(s);
  ref.current = s;
  useEffect(() => {
    const tick = () => {
      const cfg = ref.current;
      if (!cfg.enabled) return;
      const now = new Date(), today = toKey(now), nowMin = now.getHours() * 60 + now.getMinutes();
      const st = getState();
      const fire = (key: string, title: string, body: string) => { if (fireOnce(key, title, body, cfg.sound)) toast(title, { description: body }); };
      if (cfg.habitTime && nowMin >= toMin(cfg.habitTime) && nowMin < toMin(cfg.habitTime) + 60)
        fire(`habit|${today}`, id ? "Waktunya isi tracker" : "Time to log your habits", id ? "Catat kebiasaan hari ini di Daily Tracker." : "Fill in today's Daily Tracker.");
      const near = (t: string | null) => t && nowMin >= toMin(t) - cfg.agendaLead && nowMin <= toMin(t);
      for (const it of itemsOn(st.plannerItems, today))
        if (it.status === "PLANNED" && near(it.startTime))
          fire(`plan|${it.id}|${today}|${it.startTime}`, it.title, `${id ? "Mulai" : "Starts"} ${it.startTime}`);
      for (const o of activeOn(occurrencesIn(st.routines, st.routineExceptions, today, today), today))
        if (near(o.startTime)) fire(`rout|${o.key}|${o.startTime}`, o.title, `${id ? "Mulai" : "Starts"} ${o.startTime}`);
      const a = activeSession(st.focusSessions);
      if (a && a.status === "RUNNING") {
        const mins = Math.floor(sessionSeconds(a, Date.now()) / 60);
        fireOnce(`focusstart|${a.id}`, id ? "Focus sedang berjalan" : "Focus timer running", (a.title || (id ? "Sesi fokus" : "Focus session")) + (cfg.focusMinutes ? ` · ${id ? "target" : "target"} ${cfg.focusMinutes}m` : ""), false);
        // Lightweight progress pop-up every 5 minutes (replaces previous via same tag).
        if (mins > 0 && mins % 5 === 0 && Notification?.permission === "granted" && document.hidden) {
          try { new Notification(id ? "Focus berjalan" : "Focus running", { body: `${mins} ${id ? "menit" : "min"}`, tag: `focus-progress|${a.id}`, icon: "/favicon.svg", silent: true }); } catch { /* */ }
        }
      }
      if (cfg.focusMinutes && a && a.status === "RUNNING" && sessionSeconds(a, Date.now()) >= cfg.focusMinutes * 60)
        fire(`focus|${a.id}|${cfg.focusMinutes}`, id ? "Target fokus tercapai" : "Focus target reached", id ? `${cfg.focusMinutes} menit fokus selesai. Istirahat sejenak?` : `${cfg.focusMinutes} focused minutes done. Take a break?`);
    };
    tick();
    const t = setInterval(tick, 20_000);
    // Live timer in the browser tab title while a focus session runs.
    const base = document.title;
    const title = setInterval(() => {
      const a = activeSession(getState().focusSessions);
      if (a) {
        const sec = sessionSeconds(a, Date.now()), p = (n: number) => String(n).padStart(2, "0");
        const clock = `${sec >= 3600 ? `${Math.floor(sec / 3600)}:` : ""}${p(Math.floor((sec % 3600) / 60))}:${p(sec % 60)}`;
        document.title = `${a.status === "PAUSED" ? "⏸" : "⏱"} ${clock} · AWWAB`;
      } else if (document.title.includes("· AWWAB")) document.title = base;
    }, 1000);
    return () => { clearInterval(t); clearInterval(title); document.title = base; };
  }, [id]);
  return null;
}

export function NotifyCard() {
  const s = useNotifySettings();
  const id = useLang() === "id";
  const set = (p: Partial<typeof s>) => saveNotify({ ...loadNotify(), ...p });
  const perm = notifySupported() ? Notification.permission : "unsupported";
  const toggle = async () => {
    if (!s.enabled) { await requestPermission(); chime(); }
    set({ enabled: !s.enabled });
  };
  return (
    <section className="surface space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-h3 flex items-center gap-2"><Bell className="h-4 w-4" />{id ? "Notifikasi & alarm" : "Notifications & alarms"}</h2>
          <p className="text-sm text-muted-foreground">{id ? "Berbunyi selama AWWAB terbuka di perangkat ini." : "Rings while AWWAB is open on this device."}</p>
        </div>
        <button className={`btn ${s.enabled ? "btn-soft" : "btn-primary"}`} onClick={toggle}>{s.enabled ? (id ? "Matikan" : "Turn off") : (id ? "Aktifkan" : "Turn on")}</button>
      </div>
      {s.enabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="mb-1 block text-sm font-bold">{id ? "Pengingat habit harian" : "Daily habit reminder"}</span>
            <input className="field" type="time" value={s.habitTime ?? ""} onChange={(e) => set({ habitTime: e.target.value || null })} /></label>
          <label><span className="mb-1 block text-sm font-bold">{id ? "Ingatkan agenda/event (menit sebelum)" : "Agenda/event reminder (minutes before)"}</span>
            <input className="field" type="number" min={0} max={240} value={s.agendaLead} onChange={(e) => set({ agendaLead: Math.max(0, Number(e.target.value) || 0) })} /></label>
          <label><span className="mb-1 block text-sm font-bold">{id ? "Alarm Focus Hub (menit, kosong = mati)" : "Focus Hub alarm (minutes, empty = off)"}</span>
            <input className="field" type="number" min={1} value={s.focusMinutes ?? ""} onChange={(e) => set({ focusMinutes: Number(e.target.value) > 0 ? Number(e.target.value) : null })} /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-bold">
            <input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} />{id ? "Bunyikan suara" : "Play sound"}</label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button className="btn btn-ghost" onClick={() => { chime(); if (perm === "granted") new Notification("AWWAB", { body: id ? "Tes notifikasi" : "Test notification", icon: "/favicon.svg" }); }}>{id ? "Tes" : "Test"}</button>
            {perm !== "granted" && <span className="text-xs text-muted-foreground">{perm === "unsupported" ? (id ? "Browser ini tidak mendukung pop-up; suara & pesan di app tetap jalan." : "Pop-ups unsupported; sound and in-app alerts still work.") : (id ? "Izin pop-up belum diberikan — izinkan di pengaturan browser." : "Pop-up permission not granted — allow it in browser settings.")}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
export { DEFAULT_NOTIFY };
