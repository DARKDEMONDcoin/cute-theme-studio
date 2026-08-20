/** @doc Scheduled Tasks — runs/scheduled tabs with a full new-schedule sheet. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  Search,
  X,
  Trash2,
  Zap,
} from "lucide-react";
import { goBackOr } from "@/lib/navigation";

type Repeat = "hourly" | "daily" | "weekly" | "monthly";

interface Task {
  id: string;
  title: string;
  prompt: string;
  repeat: Repeat;
  time: string;
  neverEnds: boolean;
  skipConfirmations: boolean;
  runOption: string;
  agent: string;
  createdAt: number;
  lastRun?: number;
}

const KEY = "megsy.scheduledTasks.v1";
const load = (): Task[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};
const persist = (t: Task[]) => localStorage.setItem(KEY, JSON.stringify(t));

const REPEATS: Repeat[] = ["hourly", "daily", "weekly", "monthly"];
const AGENTS = ["Megsy 1.6 Lite", "Megsy 1.6", "Megsy Pro"];
const RUN_OPTIONS = ["Same task", "New task"];

export default function ScheduledTasksPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"runs" | "scheduled">("runs");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("daily");
  const [time, setTime] = useState("08:00");
  const [neverEnds, setNeverEnds] = useState(true);
  const [skipConfirmations, setSkipConfirmations] = useState(false);
  const [runOption, setRunOption] = useState(RUN_OPTIONS[0]);
  const [agent, setAgent] = useState(AGENTS[0]);

  useEffect(() => setTasks(load()), []);

  const runs = useMemo(() => tasks.filter((t) => t.lastRun), [tasks]);
  const list = tab === "runs" ? runs : tasks;

  const reset = () => {
    setTitle("");
    setPrompt("");
    setRepeat("daily");
    setTime("08:00");
    setNeverEnds(true);
    setSkipConfirmations(false);
    setRunOption(RUN_OPTIONS[0]);
    setAgent(AGENTS[0]);
  };

  const saveTask = () => {
    if (!title.trim() && !prompt.trim()) return;
    const next = [
      ...tasks,
      {
        id: crypto.randomUUID(),
        title: title.trim() || prompt.trim().slice(0, 40),
        prompt: prompt.trim(),
        repeat,
        time,
        neverEnds,
        skipConfirmations,
        runOption,
        agent,
        createdAt: Date.now(),
      },
    ];
    setTasks(next);
    persist(next);
    setOpen(false);
    setTab("scheduled");
    reset();
  };

  const remove = (id: string) => {
    const next = tasks.filter((t) => t.id !== id);
    setTasks(next);
    persist(next);
  };

  return (
    <div className="st-root" dir="ltr">
      <style>{stCss}</style>
      <div className="st-screen">
        <header className="st-top">
          <button type="button" className="st-iconbtn" aria-label="Back" onClick={() => goBackOr(navigate, "/settings")}>
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <h1 className="st-title">Scheduled tasks</h1>
          <button type="button" className="st-iconbtn" aria-label="New schedule" onClick={() => setOpen(true)}>
            <Plus className="w-5 h-5" strokeWidth={2} />
          </button>
        </header>

        <div className="st-tabs" role="tablist">
          {(["runs", "scheduled"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`st-tab ${tab === k ? "is-active" : ""}`}
              onClick={() => setTab(k)}
            >
              {k === "runs" ? "Runs" : "Scheduled"}
            </button>
          ))}
        </div>

        <main className="st-body">
          {list.length === 0 ? (
            <div className="st-empty st-rise">
              <Search className="st-empty-icon" strokeWidth={1.4} />
              <p className="st-empty-text">{tab === "runs" ? "No runs yet" : "No schedules yet"}</p>
              <button type="button" className="st-empty-cta" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" /> New schedule
              </button>
            </div>
          ) : (
            <div className="st-card st-rise">
              {list.map((t) => (
                <div key={t.id} className="st-item">
                  <span className="st-item-text">
                    <span className="st-item-title">{t.title}</span>
                    <span className="st-item-sub">
                      {t.repeat} · {t.time}
                    </span>
                  </span>
                  <button type="button" className="st-del" aria-label="Delete" onClick={() => remove(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {open && (
        <div className="st-overlay" role="dialog" aria-modal="true" aria-label="New scheduled task">
          <div className="st-sheet">
            <header className="st-sheet-top">
              <span className="st-iconbtn st-ghost" />
              <h2 className="st-sheet-title">New scheduled task</h2>
              <button type="button" className="st-iconbtn" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </header>

            <div className="st-sheet-body">
              <p className="st-label">Title</p>
              <input
                className="st-input"
                placeholder="AI news digest"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <p className="st-label">Schedule</p>
              <div className="st-card">
                <label className="st-row">
                  <span className="st-row-label">Repeat</span>
                  <span className="st-row-value">
                    <select className="st-select" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                      {REPEATS.map((r) => (
                        <option key={r} value={r}>
                          {r[0].toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                    <ChevronsUpDown className="st-row-chev" />
                  </span>
                </label>
                <label className="st-row">
                  <span className="st-row-label">Time</span>
                  <span className="st-row-value">
                    <input type="time" className="st-time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </span>
                </label>
                <label className="st-row">
                  <span className="st-row-label">Never ends</span>
                  <input
                    type="checkbox"
                    className="st-switch"
                    checked={neverEnds}
                    onChange={(e) => setNeverEnds(e.target.checked)}
                  />
                </label>
              </div>

              <p className="st-label">Prompt</p>
              <textarea
                className="st-textarea"
                rows={4}
                placeholder="Summarize the latest AI industry news"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />

              <p className="st-label">Approval requests</p>
              <div className="st-card">
                <label className="st-row">
                  <span className="st-row-label">Skip confirmations</span>
                  <input
                    type="checkbox"
                    className="st-switch"
                    checked={skipConfirmations}
                    onChange={(e) => setSkipConfirmations(e.target.checked)}
                  />
                </label>
              </div>
              <p className="st-hint">Approval is required before sending and publishing.</p>

              <p className="st-label">Advanced settings</p>
              <div className="st-card">
                <label className="st-row">
                  <span className="st-row-label">Run options</span>
                  <span className="st-row-value">
                    <select className="st-select" value={runOption} onChange={(e) => setRunOption(e.target.value)}>
                      {RUN_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <ChevronsUpDown className="st-row-chev" />
                  </span>
                </label>
                <button type="button" className="st-row" onClick={() => navigate("/settings/mcp")}>
                  <span className="st-row-label">Connectors</span>
                  <span className="st-row-value">
                    <Zap className="w-4 h-4 st-accent" />
                    <ChevronRight className="st-row-chev" />
                  </span>
                </button>
                <label className="st-row">
                  <span className="st-row-label">Agent</span>
                  <span className="st-row-value">
                    <select className="st-select" value={agent} onChange={(e) => setAgent(e.target.value)}>
                      {AGENTS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <ChevronsUpDown className="st-row-chev" />
                  </span>
                </label>
                <div className="st-row">
                  <span className="st-row-label">Project</span>
                  <span className="st-row-value st-muted">
                    None <ChevronRight className="st-row-chev" />
                  </span>
                </div>
                <div className="st-row">
                  <span className="st-row-label">Cloud computer</span>
                  <span className="st-row-value st-muted">
                    None <ChevronRight className="st-row-chev" />
                  </span>
                </div>
              </div>
            </div>

            <footer className="st-sheet-foot">
              <button type="button" className="st-save" onClick={saveTask}>
                Save
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

const stCss = `
.st-root {
  min-height: 100dvh; background: var(--mn-bg); color: var(--mn-fg);
  display: flex; justify-content: center;
  font-family: -apple-system, "SF Pro Display", Inter, "Segoe UI", Roboto, sans-serif;
}
.st-screen { width: 100%; max-width: 420px; }
.st-top {
  position: sticky; top: 0; z-index: 5; background: var(--mn-bg);
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 8px) 8px 8px;
}
.st-iconbtn:focus, .st-iconbtn:focus-visible { outline: none; box-shadow: none; background: transparent; }
.st-iconbtn {
  width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 0; color: var(--mn-fg); cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.st-ghost { pointer-events: none; }
.st-title, .st-sheet-title { font-size: 16px; font-weight: 600; margin: 0; }
.st-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; margin: 4px 12px 10px; background: var(--mn-seg); border-radius: 10px; padding: 3px; }
.st-tab { border: 0; background: transparent; color: var(--mn-muted); font-size: 13px; font-weight: 500; padding: 7px 0; border-radius: 8px; cursor: pointer; }
.st-tab.is-active { background: var(--mn-seg-active); color: var(--mn-seg-active-fg); }
.st-body { padding: 6px 12px 32px; }
.st-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24vh 0 0; }
.st-empty-icon { width: 38px; height: 38px; color: var(--mn-faint); }
.st-empty-text { margin: 0; color: var(--mn-muted); font-size: 13px; }
.st-empty-cta {
  display: inline-flex; align-items: center; gap: 7px; background: #333; color: var(--mn-fg-strong);
  border: 0; border-radius: 10px; padding: 9px 15px; font-size: 13px; font-weight: 500; cursor: pointer;
}
.st-card { background: var(--mn-card); border-radius: 14px; padding: 0 12px; }
.st-item { display: flex; align-items: center; gap: 8px; padding: 12px 0; border-bottom: 1px solid var(--mn-sep); }
.st-item:last-child { border-bottom: 0; }
.st-item-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.st-item-title { font-size: 13.5px; }
.st-item-sub { font-size: 11.5px; color: var(--mn-muted); text-transform: capitalize; }
.st-del { background: transparent; border: 0; color: var(--mn-muted); cursor: pointer; padding: 5px; }

.st-overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.55); display: flex; align-items: flex-end; justify-content: center; }
.st-sheet {
  width: 100%; max-width: 420px; height: 92dvh; background: var(--mn-bg);
  border-radius: 18px 18px 0 0; display: flex; flex-direction: column; overflow: hidden;
  animation: st-up .28s cubic-bezier(.22,.61,.36,1) both;
}
.st-sheet-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 10px 10px; }
.st-sheet-top .st-iconbtn { width: 30px; height: 30px; }
.st-sheet-title { flex: 1; text-align: center; }
.st-sheet-body { flex: 1; overflow-y: auto; padding: 4px 12px 20px; }
.st-label { margin: 18px 4px 7px; font-size: 11.5px; color: var(--mn-muted); }
.st-input, .st-textarea {
  width: 100%; background: var(--mn-card); border: 0; border-radius: 12px; color: var(--mn-fg);
  font-size: 13.5px; padding: 12px; outline: none; font-family: inherit; resize: none;
}
.st-input::placeholder, .st-textarea::placeholder { color: var(--mn-faint); }
.st-row {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 0;
  border-bottom: 1px solid var(--mn-sep); background: transparent; border-left: 0; border-right: 0; border-top: 0;
  color: inherit; font-size: 13.5px; text-align: left; cursor: pointer;
}
.st-card > .st-row:last-child { border-bottom: 0; }
.st-row-label { flex: 1; }
.st-row-value { display: inline-flex; align-items: center; gap: 5px; color: var(--mn-fg); font-size: 13px; }
.st-muted { color: var(--mn-muted); }
.st-accent { color: var(--mn-accent); }
.st-row-chev { width: 14px; height: 14px; color: var(--mn-faint); }
.st-select {
  appearance: none; background: transparent; border: 0; color: var(--mn-fg); font-size: 13px;
  font-family: inherit; outline: none; text-align: right; cursor: pointer;
}
.st-select option { background: var(--mn-card); color: var(--mn-fg); }
.st-time { background: var(--mn-seg-active); border: 0; border-radius: 7px; color: var(--mn-fg); font-size: 13px; padding: 5px 8px; font-family: inherit; }
.st-switch {
  appearance: none; -webkit-appearance: none; background-image: none; box-shadow: none; outline: none; width: 42px; height: 25px; border-radius: 999px; background: color-mix(in srgb, var(--mn-muted) 55%, transparent);
  position: relative; cursor: pointer; transition: background .18s ease; flex: none;
}
.st-switch::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 19px; height: 19px;
  border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .18s ease;
}
.st-switch:checked { background: var(--mn-accent) !important; }
.st-switch:checked::after { transform: translateX(17px); }
.st-hint { margin: 6px 4px 0; font-size: 11px; color: var(--mn-faint); }
.st-sheet-foot { padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 12px); background: var(--mn-bg); }
.st-save {
  width: 100%; height: 44px; border: 0; border-radius: 12px; background: var(--mn-cta-bg); color: var(--mn-cta-fg);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.st-rise { animation: st-rise .32s cubic-bezier(.22,.61,.36,1) both; }
@keyframes st-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes st-up { from { transform: translateY(20px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .st-rise, .st-sheet { animation: none; } }
`;
