/** @doc Data controls detail — lists and deletes one category of user-stored content. */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Trash2, Image as ImageIcon, Video, FileText, Globe, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserLang } from "@/lib/authI18n";
import { SubShell, SubCard } from "@/components/settings/SubShell";

type Item = {
  id: string;
  title: string;
  sub?: string;
  url?: string | null;
  thumb?: string | null;
  created_at?: string;
};

type Cfg = {
  table: string;
  titleAr: string;
  titleEn: string;
  emptyAr: string;
  emptyEn: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  select: string;
  filter?: (b: any) => any;
  map: (r: any) => Item;
};

const CONFIGS: Record<string, Cfg> = {
  images: {
    table: "media_assets",
    titleAr: "Images",
    titleEn: "Images",
    emptyAr: "No images yet",
    emptyEn: "No images yet",
    icon: ImageIcon,
    select: "id, prompt, model, public_url, created_at",
    filter: (b) => b.eq("kind", "image"),
    map: (r) => ({ id: r.id, title: r.prompt || "Image", sub: r.model, url: r.public_url, thumb: r.public_url, created_at: r.created_at }),
  },
  videos: {
    table: "media_assets",
    titleAr: "Videos",
    titleEn: "Videos",
    emptyAr: "No videos yet",
    emptyEn: "No videos yet",
    icon: Video,
    select: "id, prompt, model, public_url, duration_seconds, created_at",
    filter: (b) => b.eq("kind", "video"),
    map: (r) => ({
      id: r.id,
      title: r.prompt || "Video",
      sub: [r.model, r.duration_seconds ? `${r.duration_seconds}s` : null].filter(Boolean).join(" · "),
      url: r.public_url,
      created_at: r.created_at,
    }),
  },
  files: {
    table: "user_assets",
    titleAr: "Files",
    titleEn: "Files",
    emptyAr: "No files yet",
    emptyEn: "No files yet",
    icon: FileText,
    select: "id, original_filename, mime_type, size_bytes, public_url, created_at",
    map: (r) => ({
      id: r.id,
      title: r.original_filename || "File",
      sub: [r.mime_type, r.size_bytes ? `${Math.max(1, Math.round(r.size_bytes / 1024))} KB` : null]
        .filter(Boolean)
        .join(" · "),
      url: r.public_url,
      created_at: r.created_at,
    }),
  },
  sites: {
    table: "generated_sites",
    titleAr: "Published sites",
    titleEn: "Published sites",
    emptyAr: "No published sites",
    emptyEn: "No published sites",
    icon: Globe,
    select: "id, title, status, published_url, preview_url, share_slug, created_at",
    map: (r) => ({
      id: r.id,
      title: r.title || "Untitled site",
      sub: r.status,
      url: r.published_url || r.preview_url || (r.share_slug ? `/s/${r.share_slug}` : null),
      created_at: r.created_at,
    }),
  },
  shared: {
    table: "conversations",
    titleAr: "Shared chats",
    titleEn: "Shared chats",
    emptyAr: "No shared chats",
    emptyEn: "No shared chats",
    icon: Share2,
    select: "id, title, share_id, created_at",
    filter: (b) => b.eq("is_shared", true),
    map: (r) => ({
      id: r.id,
      title: r.title || "Untitled chat",
      url: r.share_id ? `/share/${r.share_id}` : null,
      created_at: r.created_at,
    }),
  },
};

export default function DataCategoryPage() {
  const { category = "" } = useParams();
  const lang = useUserLang();
  const isAr = lang === "ar" || lang === "ar-eg" || lang === "he" || lang === "fa";
  const cfg = CONFIGS[category];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cfg) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    let query: any = supabase.from(cfg.table as any).select(cfg.select).eq("user_id", uid);
    if (cfg.filter) query = cfg.filter(query);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    setItems(((data as any[]) || []).map(cfg.map));
    setLoading(false);
  }, [cfg]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!cfg) return;
    setBusy(id);
    if (cfg.table === "conversations") {
      const { error } = await supabase.from("conversations").update({ is_shared: false }).eq("id", id);
      if (error) toast.error(error.message);
      else setItems((p) => p.filter((i) => i.id !== id));
    } else {
      const { error } = await supabase.from(cfg.table as any).delete().eq("id", id);
      if (error) toast.error(error.message);
      else setItems((p) => p.filter((i) => i.id !== id));
    }
    setBusy(null);
  };

  if (!cfg) {
    return (
      <SubShell title={"Data controls"} backTo="/settings/data">
        <SubCard>
          <p className="text-[13px] text-[color:var(--mn-muted)]">
            {"Unknown section"}
          </p>
        </SubCard>
      </SubShell>
    );
  }

  const Icon = cfg.icon;

  return (
    <SubShell title={isAr ? cfg.titleAr : cfg.titleEn} backTo="/settings/data">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[color:var(--mn-muted)]" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Icon className="w-9 h-9 text-[color:var(--mn-faint)]" strokeWidth={1.4} />
          <p className="text-[13px] text-[color:var(--mn-muted)]">{isAr ? cfg.emptyAr : cfg.emptyEn}</p>
        </div>
      ) : (
        <div className="rounded-[14px] overflow-hidden bg-[var(--mn-card)] divide-y divide-[color:var(--mn-sep)]">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 px-4 py-3">
              {it.thumb ? (
                <img
                  src={it.thumb}
                  alt={it.title}
                  loading="lazy"
                  className="w-10 h-10 rounded-[8px] object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-[8px] bg-[color:var(--mn-press)] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[color:var(--mn-muted)]" strokeWidth={1.6} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-[color:var(--mn-fg)] truncate">{it.title}</p>
                <p className="text-[11.5px] text-[color:var(--mn-muted)] truncate mt-0.5">
                  {[it.sub, it.created_at ? new Date(it.created_at).toLocaleDateString() : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {it.url && (
                <a
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-[color:var(--mn-muted)] hover:text-[color:var(--mn-fg)]"
                  aria-label={"Open"}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                type="button"
                onClick={() => remove(it.id)}
                disabled={busy === it.id}
                aria-label={"Delete"}
                className="p-2 text-[color:var(--mn-danger)] disabled:opacity-50"
              >
                {busy === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </SubShell>
  );
}
