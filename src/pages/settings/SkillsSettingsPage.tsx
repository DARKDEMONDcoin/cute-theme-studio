/** @doc Browse and manage installed skills. */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  Trash2,
  X,
  Plus,
  Paperclip,
  Loader2,
  Sparkles,
  Search,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { m as motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSkills, type Skill } from "@/hooks/useSkills";
import { SKILL_TOOLS, SKILL_MODELS } from "@/lib/skillTools";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import MegsyStar from "@/components/files/MegsyStar";
// (goBackOr no longer needed — SubShell handles back nav)
import { getActiveWorkspaceId } from "@/lib/activeWorkspace";
import { SubShell } from "@/components/settings/SubShell";
import { cn } from "@/lib/utils";
import { SkillsAddMenu } from "./components/SkillsExtras";

import { sanitizeErrorMessage } from "@/lib/sanitizeError";
type DraftSkill = Partial<Skill> & {
  name: string;
  description: string;
  body: string;
  triggers: string[];
  enabled_tools: string[];
};

const emptyDraft = (): DraftSkill => ({
  name: "",
  description: "",
  body: "",
  triggers: [],
  enabled_tools: [],
  preferred_model: null,
  icon: null,
});

const SUGGESTIONS = [
  "A YC pitch coach",
  "A TikTok hooks copywriter",
  "A senior code reviewer",
  "A no-nonsense legal advisor",
  "A growth-loop strategist",
  "A 5th grade math tutor",
];

export default function SkillsSettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mySkills, librarySkills, loading, reload, toggleEnabled } = useSkills();
  const [editing, setEditing] = useState<DraftSkill | null>(null);
  const [seedPrompt, setSeedPrompt] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [triggerInput, setTriggerInput] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "enabled">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open the designer when arriving with a seed prompt from /settings/skills/new
  useEffect(() => {
    const seed = (location.state as { seed?: string } | null)?.seed;
    if (seed && seed.trim()) {
      setSeedPrompt(seed.trim());
      setEditing(emptyDraft());
      // Clear the navigation state so refresh doesn't re-trigger
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const startNew = (prompt = "") => {
    setSeedPrompt(prompt);
    setEditing(emptyDraft());
  };
  const startEdit = (s: Skill) => {
    setSeedPrompt("");
    setEditing({
      ...s,
      body: s.body || s.instructions || "",
      triggers: s.triggers || [],
      enabled_tools: s.enabled_tools || [],
    });
  };

  const handleSave = async (silent = false) => {
    if (!editing) return;
    if (!editing.name.trim()) {
      if (!silent) toast.error("Name is required");
      return;
    }
    if (!editing.body.trim()) {
      if (!silent) toast.error("Instructions are required");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      if (!silent) toast.error("Sign in required");
      return;
    }

    const payload = {
      user_id: user.id,
      workspace_id: getActiveWorkspaceId(),
      name: editing.name.trim(),
      description: editing.description?.trim() || "",
      instructions: editing.body.trim().slice(0, 6000),
      body: editing.body.trim(),
      triggers: editing.triggers,
      enabled_tools: editing.enabled_tools,
      preferred_model:
        editing.preferred_model && editing.preferred_model !== "auto"
          ? editing.preferred_model
          : null,
      icon: editing.icon || null,
    };

    const res = editing.id
      ? await supabase.from("skills").update(payload).eq("id", editing.id)
      : await supabase.from("skills").insert(payload).select("id").single();

    setSaving(false);
    if (res.error) {
      if (!silent) toast.error(res.error.message);
      return;
    }
    // For brand-new skills, capture the new id so subsequent auto-saves UPDATE in place
    const newId = (res.data as { id?: string } | null)?.id;
    if (!editing.id && newId) {
      setEditing({ ...editing, id: newId });
    }
    if (!silent) {
      toast.success(editing.id ? "Updated" : "Created");
    }
    reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this skill?")) return;
    const { error } = await supabase.from("skills").delete().eq("id", id);
    if (error) {
      toast.error(sanitizeErrorMessage(error, "Something went wrong"));
      return;
    }
    toast.success("Deleted");
    reload();
  };

  const handleAddFromLibrary = async (s: Skill) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    const { error } = await supabase.from("skills").insert({
      user_id: user.id,
      workspace_id: getActiveWorkspaceId(),
      name: s.name,
      description: s.description,
      instructions: s.instructions,
      body: s.body || s.instructions,
      triggers: s.triggers || [],
      enabled_tools: s.enabled_tools || [],
      preferred_model: s.preferred_model,
      icon: s.icon,
      is_enabled: true,
    });
    if (error) {
      toast.error(sanitizeErrorMessage(error, "Something went wrong"));
      return;
    }
    toast.success(`Added "${s.name}"`);
    reload();
  };

  const handleImportZip = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      toast.error("Please pick a .zip file");
      return;
    }
    setImporting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const form = new FormData();
      form.append("file", file);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-skill`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: form,
      });
      const json = await resp.json();
      if (!resp.ok || json.error) throw new Error(json.error || "Import failed");
      toast.success(`Imported "${json.name}"`);
      reload();
    } catch (e: unknown) {
      toast.error(sanitizeErrorMessage(e, "Import failed"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleTool = (name: string) => {
    if (!editing) return;
    const has = editing.enabled_tools.includes(name);
    setEditing({
      ...editing,
      enabled_tools: has
        ? editing.enabled_tools.filter((t) => t !== name)
        : [...editing.enabled_tools, name],
    });
  };

  const addTrigger = () => {
    if (!editing) return;
    const v = triggerInput.trim().toLowerCase();
    if (!v || editing.triggers.includes(v)) return;
    setEditing({ ...editing, triggers: [...editing.triggers, v] });
    setTriggerInput("");
  };

  const removeTrigger = (t: string) => {
    if (!editing) return;
    setEditing({ ...editing, triggers: editing.triggers.filter((x) => x !== t) });
  };

  // ===== Editor view (conversational AI Skill Designer) =====
  if (editing) {
    return (
      <SkillDesigner
        key={editing.id || "new"}
        draft={editing}
        setDraft={setEditing}
        onClose={() => {
          setEditing(null);
          setSeedPrompt("");
        }}
        onSave={handleSave}
        saving={saving}
        seedPrompt={seedPrompt}
        onImportZip={(f) => {
          handleImportZip(f).then(() => setEditing(null));
        }}
        importing={importing}
        triggerInput={triggerInput}
        setTriggerInput={setTriggerInput}
        addTrigger={addTrigger}
        removeTrigger={removeTrigger}
        toggleTool={toggleTool}
      />
    );
  }

  // ===== List view =====
  const q = query.trim().toLowerCase();
  const filtered = mySkills.filter((s) => {
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q)
    );
  });
  const visible = tab === "enabled" ? filtered.filter((s) => s.is_enabled !== false) : filtered;
  const enabledCount = mySkills.filter((s) => s.is_enabled !== false).length;

  return (
    <SubShell
      title="Skills"
      subtitle="Experts Megsy calls automatically inside chat."
      action={
        <SkillsAddMenu
          onCreateWithMegsy={() => navigate("/settings/skills/new")}
          onCreateFromFiles={(f) => handleImportZip(f)}
          onFromLibrary={() => navigate("/settings/skills/library")}
          onFromGithub={(url) =>
            navigate("/settings/skills/new", {
              state: { seed: `Build a skill from this GitHub repository: ${url}` },
            })
          }
        />
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportZip(f);
        }}
      />

      {/* Search */}
      <div className="flex items-center gap-2 h-11 px-4 rounded-[14px] bg-[var(--mn-card)]">
        <Search className="w-4 h-4 text-[color:var(--mn-muted)] shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-[color:var(--mn-fg)] placeholder:text-[color:var(--mn-muted)]"
        />
      </div>

      {/* Tabs + official library */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 h-10 p-1 rounded-full bg-[var(--mn-card)]">
          {(
            [
              { id: "all" as const, label: "All", count: mySkills.length },
              { id: "enabled" as const, label: "Enabled", count: enabledCount },
            ]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 h-8 rounded-full text-[12.5px] font-semibold transition-colors",
                tab === t.id
                  ? "bg-[color:var(--mn-fg)] text-[var(--mn-card)]"
                  : "text-[color:var(--mn-muted)]",
              )}
            >
              {t.label} {t.count > 0 && <span className="tabular-nums opacity-70">{t.count}</span>}
            </button>
          ))}
        </div>
        <button
          onClick={() => navigate("/settings/skills/library")}
          className="shrink-0 flex items-center gap-2 h-10 px-3.5 rounded-full bg-[var(--mn-card)] text-[12.5px] font-medium text-[color:var(--mn-fg)]"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[color:var(--mn-muted)]" />
          Library
          <ChevronRight className="w-3.5 h-3.5 text-[color:var(--mn-faint,var(--mn-muted))]" />
        </button>
      </div>

      {/* My skills */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[92px] rounded-[14px] bg-[var(--mn-card)] animate-pulse"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-14 px-6 rounded-[14px] bg-[var(--mn-card)]">
          <div className="mx-auto w-11 h-11 rounded-full bg-[color:var(--mn-sep)] grid place-items-center mb-3">
            <Sparkles className="w-5 h-5 text-[color:var(--mn-muted)]" />
          </div>
          <p className="text-[15px] font-semibold text-[color:var(--mn-fg)]">
            {tab === "enabled" ? "No enabled skills" : "No skills yet"}
          </p>
          <p className="text-[12.5px] mt-1.5 text-[color:var(--mn-muted)] max-w-[280px] mx-auto leading-relaxed">
            {tab === "enabled"
              ? "Enable a skill below, or create a new one."
              : "Create your first expert, or add one from the official library."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => navigate("/settings/skills/new")}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold bg-primary text-primary-foreground"
            >
              <Plus className="w-3.5 h-3.5" /> Create skill
            </button>
            <button
              onClick={() => navigate("/settings/skills/library")}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-medium bg-[color:var(--mn-sep)] text-[color:var(--mn-fg)]"
            >
              Official library
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((s) => (
            <SkillRowCard
              key={s.id}
              skill={s}
              onEdit={() => startEdit(s)}
              onDelete={() => handleDelete(s.id)}
              onToggle={(v) => toggleEnabled(s, v)}
            />
          ))}
        </div>
      )}

      {/* Inspiration */}
      {visible.length > 0 && (
        <div className="pt-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] mb-3 text-[color:var(--mn-muted)]">
            Inspiration
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.slice(0, 6).map((s) => (
              <button
                key={s}
                onClick={() => navigate("/settings/skills/new", { state: { seed: s } })}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12.5px] bg-[var(--mn-card)] text-[color:var(--mn-muted)] hover:text-[color:var(--mn-fg)] transition-colors"
              >
                <Sparkles className="w-3 h-3 text-primary" /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </SubShell>
  );
}

function SkillAvatar({ name, enabled }: { name: string; enabled: boolean }) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <div
      className={cn(
        "shrink-0 w-10 h-10 rounded-full grid place-items-center text-[14px] font-semibold",
        enabled
          ? "bg-primary/15 text-primary"
          : "bg-[color:var(--mn-sep)] text-[color:var(--mn-muted)]",
      )}
    >
      {initial}
    </div>
  );
}

function SkillRowCard({
  skill,
  onEdit,
  onDelete,
  onToggle,
}: {
  skill: Skill;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
}) {
  const enabled = skill.is_enabled !== false;

  return (
    <div
      className={cn(
        "rounded-[14px] bg-[var(--mn-card)] px-4 py-3.5 transition-opacity",
        !enabled && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <SkillAvatar name={skill.name} enabled={enabled} />
        <button onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <p className="text-[14.5px] font-semibold text-[color:var(--mn-fg)] truncate">
              {skill.name}
            </p>
            {skill.source === "system" && (
              <ShieldCheck className="w-3.5 h-3.5 text-[color:var(--mn-muted)] shrink-0" />
            )}
          </div>
          {skill.description ? (
            <p className="mt-0.5 text-[12.5px] leading-snug text-[color:var(--mn-muted)] line-clamp-2">
              {skill.description}
            </p>
          ) : (
            <p className="mt-0.5 text-[12.5px] text-[color:var(--mn-muted)]/70 italic">
              No description
            </p>
          )}
        </button>
        <Switch checked={enabled} onCheckedChange={onToggle} className="mt-0.5 shrink-0" />
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 -mb-1 -mr-1.5">
        <button
          onClick={onEdit}
          className="h-7 px-2.5 rounded-full text-[12px] font-medium text-[color:var(--mn-muted)] hover:text-[color:var(--mn-fg)] hover:bg-[color:var(--mn-sep)] transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete skill"
          className="h-7 w-7 rounded-full grid place-items-center text-[color:var(--mn-muted)] hover:text-[color:var(--mn-danger)] hover:bg-[color:var(--mn-sep)] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}


// ===========================================================================
// Conversational Skill Designer
// ===========================================================================
type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  draft?: DraftSkill;
  summary?: string;
};

const STAGES = [
  "Reading your brief",
  "Picking the right voice",
  "Writing instructions",
  "Choosing tools & triggers",
  "Polishing the draft",
];

function SkillDesigner({
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
  seedPrompt,
  onImportZip,
  importing,
  triggerInput,
  setTriggerInput,
  addTrigger,
  removeTrigger,
  toggleTool,
}: {
  draft: DraftSkill;
  setDraft: (d: DraftSkill) => void;
  onClose: () => void;
  onSave: (silent?: boolean) => void;
  saving: boolean;
  seedPrompt?: string;
  onImportZip: (file: File) => void;
  importing: boolean;
  triggerInput: string;
  setTriggerInput: (v: string) => void;
  addTrigger: () => void;
  removeTrigger: (t: string) => void;
  toggleTool: (n: string) => void;
}) {
  const isEdit = !!draft.id;
  const [messages, setMessages] = useState<ChatMsg[]>(() =>
    isEdit
      ? [
          {
            role: "assistant",
            content: `You're editing "${draft.name}". Tell me what you want to change — tone, expertise, tools, triggers — and I'll update the draft.`,
          },
        ]
      : [
          {
            role: "assistant",
            content:
              'Hey! Tell me what kind of expert you want — for example: "a YC pitch coach" or "a TikTok hooks copywriter". I\'ll ask a couple of questions and build it.',
          },
        ],
  );
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  // (preview is desktop-only, mobile users see only chat)
  const scrollRef = useRef<HTMLDivElement>(null);
  const seedSentRef = useRef(false);
  const zipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Rotate through stage labels while waiting
  useEffect(() => {
    if (!thinking) {
      setStageIdx(0);
      return;
    }
    const id = setInterval(() => setStageIdx((i) => (i + 1) % STAGES.length), 1400);
    return () => clearInterval(id);
  }, [thinking]);

  const sendText = async (text: string) => {
    if (!text || thinking) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-skill`;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await resp.json();
      if (data.action === "draft" && data.skill) {
        const s = data.skill;
        setDraft({
          ...draft,
          name: s.name || draft.name,
          description: s.description || "",
          body: s.body || "",
          triggers: Array.isArray(s.triggers)
            ? s.triggers.map((t: string) => String(t).toLowerCase())
            : [],
          enabled_tools: Array.isArray(s.enabled_tools) ? s.enabled_tools : [],
          preferred_model: s.preferred_model ?? null,
        });
        setMessages([
          ...next,
          {
            role: "assistant",
            content:
              data.summary ||
              `I've drafted "${s.name}". Open the preview to fine-tune anything, or hit Save.`,
            draft: s,
            summary: data.summary,
          },
        ]);
      } else {
        setMessages([
          ...next,
          { role: "assistant", content: data.message || "Could you tell me a bit more?" },
        ]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry — I hit an error. Try again?" }]);
    } finally {
      setThinking(false);
    }
  };

  const send = () => sendText(input.trim());

  // Auto-send the seed prompt from the hero composer
  useEffect(() => {
    if (seedSentRef.current) return;
    if (seedPrompt && seedPrompt.trim()) {
      seedSentRef.current = true;
      sendText(seedPrompt.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedPrompt]);

  const hasDraft = !!draft.name && !!draft.body;

  // Auto-save: debounce while user has a valid draft
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    if (!hasDraft) return;
    const sig = JSON.stringify({
      n: draft.name,
      d: draft.description,
      b: draft.body,
      t: draft.triggers,
      e: draft.enabled_tools,
      m: draft.preferred_model,
    });
    if (sig === lastSavedRef.current) return;
    const id = setTimeout(() => {
      lastSavedRef.current = sig;
      onSave(true);
    }, 1500);
    return () => clearTimeout(id);
  }, [
    draft.name,
    draft.description,
    draft.body,
    draft.triggers,
    draft.enabled_tools,
    draft.preferred_model,
    hasDraft,
    onSave,
  ]);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-xl hover:bg-accent/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="text-[11.5px] text-muted-foreground tabular-nums">
            {saving ? "Saving…" : hasDraft ? "Saved" : ""}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto grid lg:grid-cols-[1fr_400px] gap-0 lg:gap-6 lg:px-4 lg:py-4">
        {/* Chat panel */}
        <section className="flex flex-col h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-5rem)] lg:rounded-2xl lg:border lg:border-border/30 lg:bg-card/30 flex">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 bg-primary text-primary-foreground text-[14px] whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[92%] w-full">
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 mt-0.5">
                        <MegsyStar size={20} static />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] whitespace-pre-wrap text-foreground leading-relaxed">
                          {m.content}
                        </p>
                        {m.draft && (
                          <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[12px] font-medium">
                            Draft ready · {m.draft.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <AnimatePresence>
              {thinking && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2.5"
                >
                  <div className="shrink-0 mt-0.5">
                    <MegsyStar size={20} static />
                  </div>
                  <div className="flex-1">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={stageIdx}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                        className="text-[14px] font-semibold bg-gradient-to-r from-white via-white/85 to-white/60 bg-clip-text text-transparent"
                      >
                        {STAGES[stageIdx]}…
                      </motion.p>
                    </AnimatePresence>
                    <div className="mt-1.5 flex gap-1">
                      {STAGES.map((_, i) => (
                        <span
                          key={i}
                          className={`h-1 rounded-full transition-all ${
                            i <= stageIdx ? "bg-primary w-6" : "bg-muted w-3"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="px-4 py-3 border-t border-border/30 bg-background/50">
            <div className="relative rounded-2xl border border-border/60 bg-card focus-within:border-foreground/30 transition-colors">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    (typeof window === "undefined" || window.innerWidth >= 768)
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={
                  hasDraft
                    ? 'Refine the skill — e.g. "add SEO triggers", "make tone bolder"…'
                    : "Describe the expert you want…"
                }
                className="w-full resize-none bg-transparent outline-none text-[14px] leading-relaxed pl-12 pr-4 pt-3 pb-12 max-h-32 placeholder:text-muted-foreground/70"
              />
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportZip(f);
                }}
              />
              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                disabled={importing}
                aria-label="Import .zip"
                title="Import a SKILL.md .zip"
                className="absolute left-2.5 bottom-2.5 h-8 w-8 rounded-full hover:bg-accent/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={send}
                disabled={!input.trim() || thinking}
                className="absolute right-2.5 bottom-2.5 h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-transform"
                aria-label="Send"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Live draft preview / editor */}
        <aside className="h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-5rem)] overflow-y-auto px-4 lg:px-5 py-5 space-y-5 lg:rounded-2xl lg:border lg:border-border/30 lg:bg-card/30 hidden lg:block">
          {!hasDraft ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <MegsyStar size={36} static />
              <div className="text-[14px] font-semibold mt-4">Your skill will appear here</div>
              <p className="text-[12.5px] text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
                Chat with the designer. Once it's drafted you can fine-tune every field and save.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <MegsyStar size={12} static /> Live draft
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Name
                </Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Description
                </Label>
                <Input
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Triggers
                </Label>
                <div className="flex gap-1.5 flex-wrap p-2 rounded-xl border border-border/50 bg-card min-h-[42px]">
                  {draft.triggers.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-full bg-primary/12 text-primary"
                    >
                      {t}
                      <button
                        onClick={() => removeTrigger(t)}
                        className="hover:bg-primary/25 rounded-full p-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={triggerInput}
                    onChange={(e) => setTriggerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTrigger();
                      }
                    }}
                    onBlur={addTrigger}
                    placeholder="add keyword…"
                    className="flex-1 min-w-[100px] bg-transparent outline-none text-[12.5px] px-1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Instructions
                </Label>
                <Textarea
                  rows={10}
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  className="font-mono text-[12px] leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Tools
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {SKILL_TOOLS.map((tool) => {
                    const active = draft.enabled_tools.includes(tool.name);
                    return (
                      <button
                        key={tool.name}
                        onClick={() => toggleTool(tool.name)}
                        className={`text-left p-2 rounded-lg border transition-all ${active ? "bg-primary/10 border-primary/50" : "border-border/40 hover:border-border bg-card"}`}
                      >
                        <div className="text-[12px] font-medium">{tool.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 pb-4">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Preferred model
                </Label>
                <select
                  value={draft.preferred_model || "auto"}
                  onChange={(e) => setDraft({ ...draft, preferred_model: e.target.value })}
                  className="w-full h-10 rounded-xl border border-border/50 bg-card px-3 text-[13px] outline-none focus:border-primary/50"
                >
                  {SKILL_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
