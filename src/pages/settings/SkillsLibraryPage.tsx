/** @doc Official skills library — browse and add curated skills. */
import { useState } from "react";
import { Search, Check, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSkills, type Skill } from "@/hooks/useSkills";
import { getActiveWorkspaceId } from "@/lib/activeWorkspace";
import { SubShell } from "@/components/settings/SubShell";
import { sanitizeErrorMessage } from "@/lib/sanitizeError";

export default function SkillsLibraryPage() {
  const { mySkills, librarySkills, loading, reload } = useSkills();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const add = async (s: Skill) => {
    setBusy(s.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(null);
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
    setBusy(null);
    if (error) {
      toast.error(sanitizeErrorMessage(error, "Something went wrong"));
      return;
    }
    toast.success(`Added "${s.name}"`);
    reload();
  };

  const q = query.trim().toLowerCase();
  const items = librarySkills.filter(
    (s) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q),
  );

  return (
    <SubShell
      title="Official library"
      subtitle="Ready-made skills maintained by Megsy."
      backTo="/settings/skills"
    >
      <div className="flex items-center gap-2 h-11 px-4 rounded-full bg-muted/60 border border-border">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16 rounded-2xl bg-card border border-border">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-14 rounded-2xl bg-card border border-border">
          <p className="text-[15px] font-semibold text-card-foreground">No skills found</p>
          <p className="text-[12.5px] mt-2 text-muted-foreground">Try a different search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const installed = mySkills.some((m) => m.name === s.name);
            return (
              <div
                key={s.id}
                className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-card-foreground truncate">
                    {s.name}
                  </p>
                  {s.description && (
                    <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground line-clamp-2">
                      {s.description}
                    </p>
                  )}
                </div>
                {installed ? (
                  <span className="shrink-0 w-9 h-9 grid place-items-center text-primary">
                    <Check className="w-5 h-5" strokeWidth={2.4} />
                  </span>
                ) : (
                  <button
                    aria-label={`Add ${s.name}`}
                    disabled={busy === s.id}
                    onClick={() => add(s)}
                    className="shrink-0 w-9 h-9 rounded-xl grid place-items-center border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {busy === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SubShell>
  );
}
