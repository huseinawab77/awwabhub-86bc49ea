import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pause, Play, Square, X, Pencil, Trash2, Archive, ArchiveRestore, Plus } from "lucide-react";
import { toast } from "sonner";
import { getLang, useLang } from "@/lib/awwab/i18n";
import { addDays, formatShort, periodFor } from "@/lib/awwab/dates";
import { FOCUS_COLORS, activeSession, fmtClock, fmtDur, isInterrupted, sessionDate, sessionSeconds, summarize, type FocusCategory, type FocusSession } from "@/lib/awwab/focus";
import {
  cancelFocus, deleteFocus, editFocusTimes, finishFocus, moveFocusCategory, pauseFocus, resumeFocus, saveFocusCategory,
  setFocusCategoryArchived, startFocus, updateFocusInfo, useAppState, type AppState,
} from "@/lib/awwab/store";
import { meta, useToday } from "@/lib/awwab/useToday";
import { PageHeader, Segmented } from "@/components/awwab/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/focus")({
  head: () => meta("Focus Hub — AWWAB", "Track focused time for study, deep work and skills — a reference for filling in your daily tracker."),
  component: FocusPage,
});

const L = (id: string, en: string) => (getLang() === "id" ? id : en);
const ACTIVITY_OPTS = [
  { id: "", label: () => L("Tidak ada", "None") },
  { id: "study_session", label: () => "Study Session" },
  { id: "deep_work", label: () => "Deep Work" },
  { id: "skill_dev", label: () => "Skill Development" },
];
const selCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(getLang() === "id" ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit" });

function useNow(active: boolean) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setN(Date.now());
    tick();
    const i = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(i); document.removeEventListener("visibilitychange", tick); };
  }, [active]);
  return n;
}

function FocusPage() {
  useLang();
  const s = useAppState();
  const cats = useMemo(() => [...s.focusCategories].sort((a, b) => a.sortOrder - b.sortOrder), [s.focusCategories]);
  const act = activeSession(s.focusSessions);
  const now = useNow(true);
  const [catsOpen, setCatsOpen] = useState(false);
  const [editing, setEditing] = useState<FocusSession | null>(null);
  const interrupted = act && isInterrupted(act, now) ? act : null;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader eyebrow="Focus Hub" title={L("Waktu fokusmu", "Your focus time")} subtitle={L("Referensi waktu nyata — tidak mengubah skor. Isi Daily Tracker sendiri berdasarkan ini.", "A reference of real time — never changes your score. Fill in Daily yourself using it.")} cat="focused" />
      {act ? <ActiveTimer s={s} session={act} now={now} /> : <QuickStart s={s} cats={cats} />}
      <Summary s={s} cats={cats} />
      <History s={s} cats={cats} onEdit={setEditing} />
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setCatsOpen(true)}>{L("Kelola kategori", "Manage categories")}</Button>
      </div>
      {catsOpen && <CategoryManager s={s} cats={cats} onClose={() => setCatsOpen(false)} />}
      {editing && <EditSession s={s} session={editing} cats={cats} onClose={() => setEditing(null)} />}
      {interrupted && <InterruptedDialog session={interrupted} />}
    </div>
  );
}

function LinkFields({ s, value, onChange }: { s: AppState; value: { goalId: string | null; projectId: string | null; milestoneId: string | null; plannerItemId: string | null }; onChange: (v: Partial<typeof value>) => void }) {
  const projects = s.projects.filter((p) => !value.goalId || p.goalId === value.goalId);
  const milestones = s.milestones.filter((m) => !value.projectId || m.projectId === value.projectId);
  const planner = s.plannerItems.filter((p) => p.status === "PLANNED");
  const sel = (label: string, v: string | null, opts: { id: string; title: string }[], f: (v: string | null) => void) => (
    <label className="block text-xs font-semibold text-muted-foreground">{label}
      <select className={selCls + " mt-1"} value={v ?? ""} onChange={(e) => f(e.target.value || null)}>
        <option value="">—</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
      </select>
    </label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sel("Planner", value.plannerItemId, planner, (v) => onChange({ plannerItemId: v }))}
      {sel("Goal", value.goalId, s.goals.filter((g) => g.status === "active"), (v) => onChange({ goalId: v, projectId: null, milestoneId: null }))}
      {sel("Project", value.projectId, projects, (v) => onChange({ projectId: v, milestoneId: null }))}
      {sel("Milestone", value.milestoneId, milestones, (v) => onChange({ milestoneId: v }))}
    </div>
  );
}

function QuickStart({ s, cats }: { s: AppState; cats: FocusCategory[] }) {
  const active = cats.filter((c) => c.isActive);
  const [title, setTitle] = useState("");
  const [more, setMore] = useState(false);
  const [links, setLinks] = useState({ goalId: null as string | null, projectId: null as string | null, milestoneId: null as string | null, plannerItemId: null as string | null });
  const pickPlanner = (v: Partial<typeof links>) => {
    if (v.plannerItemId) {
      const p = s.plannerItems.find((x) => x.id === v.plannerItemId);
      if (p) {
        if (!title) setTitle(p.title);
        setLinks((l) => ({ ...l, ...v, goalId: p.goalId ?? l.goalId, projectId: p.projectId ?? l.projectId, milestoneId: p.milestoneId ?? l.milestoneId }));
        return;
      }
    }
    setLinks((l) => ({ ...l, ...v }));
  };
  const plannerCat = () => {
    const p = s.plannerItems.find((x) => x.id === links.plannerItemId);
    return p?.activityId ? active.find((c) => c.activityId === p.activityId) : undefined;
  };
  const start = (c: FocusCategory) => startFocus(c.id, { title: title.trim(), ...links, goalId: links.goalId ?? c.goalId, projectId: links.projectId ?? c.projectId });
  const suggested = plannerCat();
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <p className="text-center font-display text-5xl font-bold tabular-nums text-foreground/30">00:00</p>
      <Input className="mt-4" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L("Lagi ngerjain apa? (opsional)", "What are you working on? (optional)")} />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {active.map((c) => (
          <Button key={c.id} size="lg" className={`h-14 justify-start gap-3 text-base ${suggested?.id === c.id ? "ring-2 ring-ring" : ""}`} variant="secondary" onClick={() => start(c)}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
            <Play className="h-4 w-4" /> <span className="truncate">{c.name}</span>
          </Button>
        ))}
      </div>
      {!active.length && <p className="mt-3 text-center text-sm text-muted-foreground">{L("Belum ada kategori aktif.", "No active categories.")}</p>}
      <button className="mt-3 text-xs font-semibold text-muted-foreground underline" onClick={() => setMore(!more)}>{more ? L("Sembunyikan tautan", "Hide links") : L("Hubungkan ke Planner / Goal (opsional)", "Link to Planner / Goal (optional)")}</button>
      {more && <div className="mt-3"><LinkFields s={s} value={links} onChange={pickPlanner} /></div>}
    </section>
  );
}

function ActiveTimer({ s, session, now }: { s: AppState; session: FocusSession; now: number }) {
  const cat = s.focusCategories.find((c) => c.id === session.categoryId);
  const sec = sessionSeconds(session, now);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notes, setNotes] = useState(session.notes);
  const paused = session.status === "PAUSED";
  return (
    <section className="rounded-3xl border bg-card p-5 text-center shadow-sm">
      <p className="inline-flex items-center gap-2 text-sm font-bold"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat?.color }} />{cat?.name ?? "—"}{paused && <span className="text-muted-foreground">· {L("Dijeda", "Paused")}</span>}</p>
      <Input className="mx-auto mt-2 max-w-md text-center" value={session.title} onChange={(e) => updateFocusInfo(session.id, { title: e.target.value })} placeholder={L("Judul sesi (opsional)", "Session title (optional)")} />
      <p className={`my-6 font-display text-6xl font-bold tabular-nums sm:text-7xl ${paused ? "text-muted-foreground" : ""}`} aria-live="off">{fmtClock(sec)}</p>
      <div className="grid grid-cols-2 gap-3 sm:mx-auto sm:max-w-md">
        {paused
          ? <Button size="lg" variant="secondary" className="h-14" onClick={() => resumeFocus(session.id)}><Play className="mr-2 h-5 w-5" />{L("Lanjut", "Resume")}</Button>
          : <Button size="lg" variant="secondary" className="h-14" onClick={() => pauseFocus(session.id)}><Pause className="mr-2 h-5 w-5" />{L("Jeda", "Pause")}</Button>}
        <Button size="lg" className="h-14" onClick={() => { finishFocus(session.id); toast.success(L(`Sesi selesai · ${fmtDur(sec)}`, `Session done · ${fmtDur(sec)}`)); }}><Square className="mr-2 h-5 w-5" />{L("Selesai", "Finish")}</Button>
      </div>
      <Textarea className="mt-4" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => updateFocusInfo(session.id, { notes })} placeholder={L("Catatan (opsional)", "Notes (optional)")} />
      <div className="mt-3 text-left"><LinkFields s={s} value={session} onChange={(v) => updateFocusInfo(session.id, v)} /></div>
      <button className="mt-4 text-sm font-semibold text-destructive" onClick={() => (sec > 60 ? setConfirmCancel(true) : cancelFocus(session.id))}><X className="mr-1 inline h-4 w-4" />{L("Batalkan sesi", "Cancel session")}</button>
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L(`Buang ${fmtDur(sec)} waktu fokus?`, `Discard ${fmtDur(sec)} of focus?`)}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{L("Sesi yang dibatalkan tidak dihitung.", "Cancelled sessions are not counted.")}</p>
          <DialogFooter><Button variant="outline" onClick={() => setConfirmCancel(false)}>{L("Kembali", "Back")}</Button><Button variant="destructive" onClick={() => { cancelFocus(session.id); setConfirmCancel(false); }}>{L("Batalkan", "Discard")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function InterruptedDialog({ session }: { session: FocusSession }) {
  const [end, setEnd] = useState("");
  const [open, setOpen] = useState(true);
  const finish = () => {
    const iso = new Date(end).toISOString();
    if (!(Date.parse(iso) > Date.parse(session.startedAt))) return toast.error(L("Jam akhir harus setelah jam mulai", "End must be after start"));
    finishFocus(session.id, iso);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{L("Sesi masih berjalan sejak lama", "A session has been running for a long time")}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{L(`Dimulai ${formatShort(sessionDate(session))} ${timeOf(session.startedAt)}. Mungkin lupa diselesaikan — kapan sebenarnya kamu berhenti?`, `Started ${formatShort(sessionDate(session))} ${timeOf(session.startedAt)}. When did you actually stop?`)}</p>
        <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} min={toLocalInput(session.startedAt)} />
        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={() => cancelFocus(session.id)}>{L("Buang", "Discard")}</Button>
          <Button variant="outline" onClick={() => setOpen(false)}>{L("Lanjutkan", "Keep running")}</Button>
          <Button disabled={!end} onClick={finish}>{L("Selesaikan", "Finish")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type View = "day" | "week" | "month";
function Summary({ s, cats }: { s: AppState; cats: FocusCategory[] }) {
  const today = useToday();
  const [view, setView] = useState<View>("week");
  const range = view === "day" ? { start: today, end: today } : periodFor(view, today);
  const trendRange = view === "day" ? { start: addDays(today, -6), end: today } : range;
  const sum = summarize(s.focusSessions, range.start, range.end);
  const trend = summarize(s.focusSessions, trendRange.start, trendRange.end).byDay;
  const max = Math.max(1, ...trend.map((d) => d.seconds));
  const dailyTarget = cats.reduce((a, c) => a + (c.isActive ? c.defaultTargetMinutes ?? 0 : 0), 0);
  const days = trend.length;
  const target = dailyTarget * (view === "day" ? 1 : days) * 60;
  return (
    <section className="rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{L("Ringkasan", "Summary")}</h2>
        <Segmented value={view} onChange={setView} options={[{ value: "day", label: L("Hari", "Day") }, { value: "week", label: L("Minggu", "Week") }, { value: "month", label: L("Bulan", "Month") }]} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label={L("Total", "Total")} value={fmtDur(sum.totalSeconds)} />
        <Stat label={L("Sesi", "Sessions")} value={String(sum.count)} />
        <Stat label={L("Rata-rata", "Average")} value={sum.count ? fmtDur(sum.avgSeconds) : "—"} />
      </div>
      {target > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">{L("Target", "Target")}: {fmtDur(sum.totalSeconds)} / {fmtDur(target)}</p>
          <div className="mt-1 h-2 rounded-full bg-beige"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (sum.totalSeconds / target) * 100)}%` }} /></div>
        </div>
      )}
      <div className="mt-5 flex h-28 items-end gap-1" aria-label={L("Tren harian", "Daily trend")}>
        {trend.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${formatShort(d.date)} · ${fmtDur(d.seconds)}`}>
            <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.seconds / max) * 96}px`, minHeight: d.seconds ? 3 : 0 }} />
            {trend.length <= 7 && <span className="text-[10px] text-muted-foreground">{formatShort(d.date).split(" ")[0]}</span>}
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {cats.filter((c) => sum.byCategory[c.id]).map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="font-semibold tabular-nums">{fmtDur(sum.byCategory[c.id] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-beige/50 p-3"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="font-display text-lg font-bold tabular-nums">{value}</p></div>
);

function History({ s, cats, onEdit }: { s: AppState; cats: FocusCategory[]; onEdit: (x: FocusSession) => void }) {
  const [limit, setLimit] = useState(20);
  const list = s.focusSessions.filter((x) => x.status === "COMPLETED" || x.status === "CANCELLED").sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const name = (id: string | null, arr: { id: string; title: string }[]) => arr.find((x) => x.id === id)?.title;
  return (
    <section className="rounded-3xl border bg-card p-5">
      <h2 className="font-display text-xl font-bold">{L("Riwayat sesi", "Session history")}</h2>
      {!list.length && <p className="mt-3 text-sm text-muted-foreground">{L("Belum ada sesi. Mulai timer di atas.", "No sessions yet. Start the timer above.")}</p>}
      <ul className="mt-3 divide-y">
        {list.slice(0, limit).map((x) => {
          const c = cats.find((k) => k.id === x.categoryId);
          const link = name(x.plannerItemId, s.plannerItems) ?? name(x.milestoneId, s.milestones) ?? name(x.projectId, s.projects) ?? name(x.goalId, s.goals);
          return (
            <li key={x.id} className="flex items-center gap-3 py-3">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c?.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{x.title || c?.name || "—"}{x.status === "CANCELLED" && <span className="ml-2 text-xs text-muted-foreground">{L("dibatalkan", "cancelled")}</span>}</p>
                <p className="truncate text-xs text-muted-foreground">{formatShort(sessionDate(x))} · {timeOf(x.startedAt)}–{x.endedAt ? timeOf(x.endedAt) : ""} · {c?.name}{link ? ` · ${link}` : ""}</p>
              </div>
              <span className="font-semibold tabular-nums">{x.status === "COMPLETED" ? fmtDur(x.durationSeconds) : "—"}</span>
              <Button size="icon" variant="ghost" aria-label={L("Ubah", "Edit")} onClick={() => onEdit(x)}><Pencil className="h-4 w-4" /></Button>
            </li>
          );
        })}
      </ul>
      {list.length > limit && <Button variant="ghost" className="w-full" onClick={() => setLimit(limit + 20)}>{L("Tampilkan lagi", "Show more")}</Button>}
    </section>
  );
}

function EditSession({ s, session, cats, onClose }: { s: AppState; session: FocusSession; cats: FocusCategory[]; onClose: () => void }) {
  const [f, setF] = useState({ ...session, start: toLocalInput(session.startedAt), end: session.endedAt ? toLocalInput(session.endedAt) : "" });
  const save = () => {
    const { categoryId, title, notes, goalId, projectId, milestoneId, plannerItemId } = f;
    if (session.status === "COMPLETED") {
      const ok = editFocusTimes(session.id, new Date(f.start).toISOString(), new Date(f.end).toISOString());
      if (!ok) return toast.error(L("Jam akhir harus setelah jam mulai", "End must be after start"));
    }
    updateFocusInfo(session.id, { categoryId, title, notes, goalId, projectId, milestoneId, plannerItemId });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{L("Ubah sesi", "Edit session")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={L("Judul", "Title")} />
          <select className={selCls} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive ? "" : ` (${L("arsip", "archived")})`}</option>)}
          </select>
          {session.status === "COMPLETED" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-muted-foreground">{L("Mulai", "Start")}<Input type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
              <label className="text-xs font-semibold text-muted-foreground">{L("Selesai", "End")}<Input type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
            </div>
          )}
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={L("Catatan", "Notes")} />
          <LinkFields s={s} value={f} onChange={(v) => setF({ ...f, ...v })} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={() => { if (confirm(L("Hapus sesi ini?", "Delete this session?"))) { deleteFocus(session.id); onClose(); } }}><Trash2 className="mr-1 h-4 w-4" />{L("Hapus", "Delete")}</Button>
          <Button onClick={save}>{L("Simpan", "Save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManager({ s, cats, onClose }: { s: AppState; cats: FocusCategory[]; onClose: () => void }) {
  const [edit, setEdit] = useState<(Partial<FocusCategory> & { name: string }) | null>(null);
  const count = (id: string) => s.focusSessions.filter((x) => x.categoryId === id && x.status === "COMPLETED").length;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{L("Kategori fokus", "Focus categories")}</DialogTitle></DialogHeader>
        {edit ? (
          <div className="space-y-3">
            <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={L("Nama, mis. Belajar Ekonometrika", "Name, e.g. Econometrics")} />
            <Textarea value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder={L("Deskripsi (opsional)", "Description (optional)")} />
            <div className="flex gap-2">{FOCUS_COLORS.map((c) => <button key={c} aria-label={c} className={`h-8 w-8 rounded-full border-2 ${edit.color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setEdit({ ...edit, color: c })} />)}</div>
            <label className="block text-xs font-semibold text-muted-foreground">{L("Target harian (menit, opsional)", "Daily target (minutes, optional)")}
              <Input type="number" min={0} value={edit.defaultTargetMinutes ?? ""} onChange={(e) => setEdit({ ...edit, defaultTargetMinutes: e.target.value ? Math.max(0, Number(e.target.value)) : null })} />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">{L("Aktivitas terkait (hanya petunjuk di Daily)", "Related activity (hint in Daily only)")}
              <select className={selCls} value={edit.activityId ?? ""} onChange={(e) => setEdit({ ...edit, activityId: e.target.value || null })}>
                {ACTIVITY_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label()}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">{L("Goal bawaan (opsional)", "Default goal (optional)")}
              <select className={selCls} value={edit.goalId ?? ""} onChange={(e) => setEdit({ ...edit, goalId: e.target.value || null, projectId: null })}>
                <option value="">—</option>{s.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">{L("Project bawaan (opsional)", "Default project (optional)")}
              <select className={selCls} value={edit.projectId ?? ""} onChange={(e) => setEdit({ ...edit, projectId: e.target.value || null })}>
                <option value="">—</option>{s.projects.filter((p) => !edit.goalId || p.goalId === edit.goalId).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>{L("Kembali", "Back")}</Button>
              <Button disabled={!edit.name.trim()} onClick={() => { saveFocusCategory({ ...edit, name: edit.name.trim() }); setEdit(null); }}>{L("Simpan", "Save")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {cats.map((c, i) => (
                <li key={c.id} className={`flex items-center gap-2 py-2 ${c.isActive ? "" : "opacity-60"}`}>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{count(c.id)} {L("sesi", "sessions")}{c.isActive ? "" : ` · ${L("diarsip", "archived")}`}</p></div>
                  <Button size="icon" variant="ghost" disabled={i === 0} aria-label="Up" onClick={() => moveFocusCategory(c.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={i === cats.length - 1} aria-label="Down" onClick={() => moveFocusCategory(c.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={L("Ubah", "Edit")} onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={c.isActive ? L("Arsipkan", "Archive") : L("Pulihkan", "Restore")} onClick={() => setFocusCategoryArchived(c.id, c.isActive)}>{c.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}</Button>
                </li>
              ))}
            </ul>
            <Button onClick={() => setEdit({ name: "", color: FOCUS_COLORS[0], activityId: null, defaultTargetMinutes: null })}><Plus className="mr-1 h-4 w-4" />{L("Kategori baru", "New category")}</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
