"use client";

import { useState, useEffect } from "react";
import {
  Loader2, Users, MessageSquare, Network, TrendingUp, Heart, Hash,
  Globe, CheckCircle2, XCircle, ExternalLink, MapPin, Link as LinkIcon,
  Calendar, Award, Zap, Filter, Search,
} from "lucide-react";
import {
  fetchSocialIntelligence,
  type SocialIntelligenceReport, type SocialProfile, type SocialPost,
  type SocialCommunity, type SocialSentiment, type SocialTopic,
} from "@/lib/osint/client";

interface Props {
  investigationId: string;
  apiPath?: "standard" | "agent";
}

const PLATFORM_COLORS: Record<string, string> = {
  reddit: "text-[var(--hack-orange)] border-[var(--hack-orange)]/40 bg-[var(--hack-orange)]/10",
  hackernews: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  github: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  mastodon: "text-[var(--hack-purple)] border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10",
  youtube: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  telegram: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  pinterest: "text-red-400 border-red-400/40 bg-red-400/10",
  flickr: "text-[var(--hack-purple)] border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10",
  soundcloud: "text-[var(--hack-orange)] border-[var(--hack-orange)]/40 bg-[var(--hack-orange)]/10",
  medium: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  vk: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  bluesky: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
};

type ViewMode = "overview" | "profiles" | "posts" | "communities" | "graph" | "sentiment";

export function SocialIntelligencePanel({ investigationId, apiPath = "standard" }: Props) {
  const [report, setReport] = useState<SocialIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("overview");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetchSocialIntelligence(investigationId, apiPath);
        if (active) { setReport(r); setLoading(false); }
      } catch (e) {
        if (active) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--hack-cyan)] mx-auto mb-3" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» scanning social platforms in parallel..."}</p>
      <p className="font-mono text-[10px] text-[var(--hack-gray)]/50 mt-1">12 platform adapters running concurrently</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report || report.totalFindings === 0) return (
    <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
      <Users className="h-8 w-8 text-[var(--hack-gray)]/30 mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">No social media presence found across {report?.platformCoverage.length || 12} platforms.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        <Stat label="Profiles" value={report.profiles.length} icon={Users} color="cyan" />
        <Stat label="Posts" value={report.posts.length} icon={MessageSquare} color="green" />
        <Stat label="Communities" value={report.communities.length} icon={Network} color="amber" />
        <Stat label="Influencers" value={report.influencers.length} icon={Award} color="green" />
        <Stat label="Topics" value={report.topics.length} icon={Hash} color="cyan" />
        <Stat label="Media" value={report.mediaItems.length} icon={Globe} color="amber" />
        <Stat label="Confidence" value={`${(report.confidence * 100).toFixed(0)}%`} icon={CheckCircle2} color="green" />
        <Stat label="Platforms" value={report.platformCoverage.filter(p => p.status === "success").length} icon={Zap} color="cyan" />
      </div>

      {/* Summary */}
      <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5 text-[var(--hack-cyan)]" />
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Social Intelligence Summary</span>
          <span className="font-mono text-[9px] text-[var(--hack-green)] border border-[var(--hack-green)]/30 px-1.5 py-0.5 ml-auto">{report.durationMs}ms</span>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{report.summary}</p>
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-[var(--hack-border)] pb-2">
        <ViewTab active={view === "overview"} onClick={() => setView("overview")} icon={Users} label="Overview" />
        <ViewTab active={view === "profiles"} onClick={() => setView("profiles")} icon={Users} label={`Profiles (${report.profiles.length})`} />
        <ViewTab active={view === "posts"} onClick={() => setView("posts")} icon={MessageSquare} label={`Posts (${report.posts.length})`} />
        <ViewTab active={view === "communities"} onClick={() => setView("communities")} icon={Network} label={`Communities (${report.communities.length})`} />
        {report.conversationGraph.nodes.length > 0 && (
          <ViewTab active={view === "graph"} onClick={() => setView("graph")} icon={Network} label="Graph" />
        )}
        <ViewTab active={view === "sentiment"} onClick={() => setView("sentiment")} icon={Heart} label="Sentiment" />
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {view === "overview" && <OverviewView report={report} />}
        {view === "profiles" && <ProfilesView profiles={report.profiles} />}
        {view === "posts" && <PostsView posts={report.posts} />}
        {view === "communities" && <CommunitiesView communities={report.communities} />}
        {view === "graph" && <GraphView report={report} />}
        {view === "sentiment" && <SentimentView report={report} />}
      </div>

      {/* Platform coverage */}
      <div className="border border-[var(--hack-border)] bg-black/20 p-3">
        <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60 mb-2 block">Platform Coverage</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {report.platformCoverage.map((p) => (
            <div key={p.platform} className="flex items-center gap-1.5 border border-[var(--hack-border)] bg-black/40 p-1.5">
              {p.status === "success" ? (
                <CheckCircle2 className="h-2.5 w-2.5 text-[var(--hack-green)] shrink-0" />
              ) : (
                <XCircle className="h-2.5 w-2.5 text-[var(--hack-red)] shrink-0" />
              )}
              <span className="font-mono text-[9px] text-[var(--hack-gray)] truncate">{p.platform}</span>
              <span className="font-mono text-[8px] text-[var(--hack-cyan)] ml-auto shrink-0">{p.findingCount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Overview View
// ============================================================================

function OverviewView({ report }: { report: SocialIntelligenceReport }) {
  return (
    <div className="space-y-4">
      {/* Key findings */}
      {report.keyFindings.length > 0 && (
        <div>
          <SectionHeader icon={Zap} title="Key Social Findings" color="green" />
          <div className="space-y-1">
            {report.keyFindings.map((f, i) => (
              <div key={i} className="border border-[var(--hack-border)] bg-black/30 p-2">
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[9px] text-[var(--hack-green)] shrink-0">[{i + 1}]</span>
                  <div className="flex-1">
                    <p className="font-mono text-[10px] text-[var(--hack-gray)]/80">{f.finding}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[8px] text-[var(--hack-cyan)]">{f.source}</span>
                      <span className="font-mono text-[8px] text-[var(--hack-green)]">{(f.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Influencers */}
      {report.influencers.length > 0 && (
        <div>
          <SectionHeader icon={Award} title="Top Influencers" color="amber" />
          <div className="space-y-1">
            {report.influencers.map((inf, i) => (
              <div key={i} className="border border-[var(--hack-border)] bg-black/30 p-2 flex items-center gap-2">
                <Award className="h-3 w-3 text-[var(--hack-amber)] shrink-0" />
                <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{inf.username}</span>
                <span className="font-mono text-[8px] text-[var(--hack-gray)]/50">{inf.platform}</span>
                <span className="font-mono text-[9px] text-[var(--hack-amber)] ml-auto">{(inf.influenceScore * 100).toFixed(0)}% influence</span>
                <a href={inf.profileUrl} target="_blank" rel="noreferrer" className="text-[var(--hack-cyan)] hover:underline">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topics */}
      {report.topics.length > 0 && (
        <div>
          <SectionHeader icon={Hash} title="Topics" color="cyan" />
          <div className="flex flex-wrap gap-1">
            {report.topics.map((t, i) => (
              <span key={i} className={`font-mono text-[9px] border px-1.5 py-0.5 ${
                t.sentiment === "positive" ? "text-[var(--hack-green)] border-[var(--hack-green)]/30" :
                t.sentiment === "negative" ? "text-[var(--hack-red)] border-[var(--hack-red)]/30" :
                "text-[var(--hack-gray)] border-[var(--hack-border)]"
              }`}>
                #{t.name} ({t.mentionCount})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Profiles View
// ============================================================================

function ProfilesView({ profiles }: { profiles: SocialProfile[] }) {
  if (profiles.length === 0) return <EmptyState message="No profiles found." icon={Users} />;
  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scroll">
      {profiles.map((p, i) => {
        const colorClass = PLATFORM_COLORS[p.platform] || "text-[var(--hack-gray)] border-[var(--hack-border)]";
        return (
          <div key={i} className={`border ${colorClass} p-3`}>
            <div className="flex items-start gap-3">
              {p.avatarUrl && (
                <img src={p.avatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold">{p.displayName || p.username}</span>
                  {p.verified && <CheckCircle2 className="h-3 w-3 text-[var(--hack-green)]" />}
                  <span className="font-mono text-[9px] text-[var(--hack-gray)]/50">@{p.username}</span>
                  <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 ml-auto">{p.platformLabel}</span>
                </div>
                {p.bio && <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-1 line-clamp-2">{p.bio}</p>}
                <div className="flex items-center gap-3 mt-1 font-mono text-[9px] text-[var(--hack-gray)]/50 flex-wrap">
                  {p.followerCount !== undefined && <span>{p.followerCount} followers</span>}
                  {p.postCount !== undefined && <span>{p.postCount} posts</span>}
                  {p.location && <span className="flex items-center gap-0.5"><MapPin className="h-2 w-2" />{p.location}</span>}
                  {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 text-[var(--hack-cyan)] hover:underline"><LinkIcon className="h-2 w-2" />{p.website.slice(0, 30)}</a>}
                  {p.accountCreated && <span className="flex items-center gap-0.5"><Calendar className="h-2 w-2" />{new Date(p.accountCreated).toLocaleDateString()}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <a href={p.profileUrl} target="_blank" rel="noreferrer" className="font-mono text-[9px] text-[var(--hack-cyan)] hover:underline flex items-center gap-0.5">
                    <ExternalLink className="h-2.5 w-2.5" /> View Profile
                  </a>
                  <div className="flex items-center gap-2 ml-auto font-mono text-[8px]">
                    <span className="text-[var(--hack-green)]">conf: {(p.confidence * 100).toFixed(0)}%</span>
                    <span className="text-[var(--hack-amber)]">auth: {(p.authenticityScore * 100).toFixed(0)}%</span>
                    <span className="text-[var(--hack-cyan)]">inf: {(p.influenceScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Posts View
// ============================================================================

function PostsView({ posts }: { posts: SocialPost[] }) {
  if (posts.length === 0) return <EmptyState message="No posts found." icon={MessageSquare} />;
  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scroll">
      {posts.map((p, i) => {
        const colorClass = PLATFORM_COLORS[p.platform] || "text-[var(--hack-gray)] border-[var(--hack-border)]";
        return (
          <div key={i} className={`border ${colorClass} p-2.5`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 uppercase">{p.platformLabel}</span>
              <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{p.author}</span>
              <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 ml-auto">{new Date(p.timestamp).toLocaleDateString()}</span>
            </div>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/80 mb-1">{p.content.slice(0, 300)}</p>
            <div className="flex items-center gap-3 font-mono text-[8px] text-[var(--hack-gray)]/50">
              {p.likes !== undefined && <span>♥ {p.likes}</span>}
              {p.comments !== undefined && <span>💬 {p.comments}</span>}
              {p.shares !== undefined && <span>↻ {p.shares}</span>}
              {p.hashtags && p.hashtags.length > 0 && <span className="text-[var(--hack-cyan)]">{p.hashtags.slice(0, 3).map(h => `#${h}`).join(" ")}</span>}
              <a href={p.postUrl} target="_blank" rel="noreferrer" className="text-[var(--hack-cyan)] hover:underline ml-auto">
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Communities View
// ============================================================================

function CommunitiesView({ communities }: { communities: SocialCommunity[] }) {
  if (communities.length === 0) return <EmptyState message="No communities found." icon={Network} />;
  return (
    <div className="space-y-2">
      {communities.map((c, i) => {
        const colorClass = PLATFORM_COLORS[c.platform] || "text-[var(--hack-gray)] border-[var(--hack-border)]";
        return (
          <div key={i} className={`border ${colorClass} p-2.5`}>
            <div className="flex items-center gap-2">
              <Network className="h-3.5 w-3.5 shrink-0" />
              <span className="font-mono text-xs font-bold">{c.name}</span>
              <span className="font-mono text-[8px] text-[var(--hack-gray)]/50">{c.platformLabel}</span>
              {c.memberCount !== undefined && <span className="font-mono text-[9px] text-[var(--hack-cyan)] ml-auto">{c.memberCount} members</span>}
            </div>
            {c.description && <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-1">{c.description.slice(0, 200)}</p>}
            <a href={c.url} target="_blank" rel="noreferrer" className="font-mono text-[9px] text-[var(--hack-cyan)] hover:underline mt-1 inline-flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" /> Visit
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Graph View (SVG-based conversation graph)
// ============================================================================

function GraphView({ report }: { report: SocialIntelligenceReport }) {
  const { nodes, edges } = report.conversationGraph;
  if (nodes.length === 0) return <EmptyState message="No graph data." icon={Network} />;

  const W = 800, H = 500;
  const positions = new Map<string, { x: number; y: number }>();
  const cx = W / 2, cy = H / 2;

  nodes.forEach((n, i) => {
    const angle = (i * 137.5) * (Math.PI / 180);
    const radius = 50 + Math.sqrt(i) * 30;
    positions.set(n.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  });

  const typeColors: Record<string, string> = {
    author: "#10b981", post: "#06b6d4", topic: "#fbbf24",
  };

  return (
    <div className="border border-[var(--hack-border)] bg-black/30">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {edges.map((e, i) => {
          const from = positions.get(e.from);
          const to = positions.get(e.to);
          if (!from || !to) return null;
          return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#333" strokeWidth="0.5" strokeOpacity="0.4" />;
        })}
        {nodes.map((n) => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          const color = typeColors[n.type] || "#9ca3af";
          const r = n.type === "author" ? 8 : n.type === "post" ? 6 : 4;
          return (
            <g key={n.id} transform={`translate(${pos.x},${pos.y})`}>
              <circle r={r} fill={color} fillOpacity="0.7" stroke={color} strokeWidth="0.5" />
              <text y={r + 8} fill="#9ca3af" fontSize="6" fontFamily="monospace" textAnchor="middle">{n.label.slice(0, 15)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================================================
// Sentiment View
// ============================================================================

function SentimentView({ report }: { report: SocialIntelligenceReport }) {
  const s = report.sentiment;
  return (
    <div className="space-y-3">
      <div className="border border-[var(--hack-border)] bg-black/30 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="h-4 w-4 text-[var(--hack-cyan)]" />
          <span className="font-mono text-xs uppercase text-[var(--hack-cyan)]">Sentiment Analysis</span>
          <span className={`font-mono text-[9px] border px-1.5 py-0.5 ml-auto uppercase ${
            s.overall === "positive" ? "text-[var(--hack-green)] border-[var(--hack-green)]/40" :
            s.overall === "negative" ? "text-[var(--hack-red)] border-[var(--hack-red)]/40" :
            s.overall === "mixed" ? "text-[var(--hack-amber)] border-[var(--hack-amber)]/40" :
            "text-[var(--hack-gray)] border-[var(--hack-border)]"
          }`}>{s.overall}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SentimentBar label="Positive" value={s.positiveRatio} color="green" />
          <SentimentBar label="Neutral" value={s.neutralRatio} color="gray" />
          <SentimentBar label="Negative" value={s.negativeRatio} color="red" />
        </div>
        <div className="flex items-center gap-4 mt-2 font-mono text-[9px] text-[var(--hack-gray)]/60">
          <span>Controversy: {(s.controversyScore * 100).toFixed(0)}%</span>
          <span>Polarization: {(s.polarizationScore * 100).toFixed(0)}%</span>
          <span>Emotions: {s.topEmotions.join(", ")}</span>
        </div>
      </div>

      {report.topics.length > 0 && (
        <div>
          <SectionHeader icon={Hash} title="Topic Trends" color="cyan" />
          <div className="space-y-1">
            {report.topics.map((t, i) => (
              <div key={i} className="border border-[var(--hack-border)] bg-black/30 p-2 flex items-center gap-2">
                <Hash className="h-2.5 w-2.5 text-[var(--hack-cyan)] shrink-0" />
                <span className="font-mono text-[10px] text-[var(--hack-gray)]">{t.name}</span>
                <span className="font-mono text-[9px] text-[var(--hack-cyan)]">{t.mentionCount}</span>
                <span className={`font-mono text-[8px] uppercase ${
                  t.trend === "rising" ? "text-[var(--hack-green)]" : t.trend === "declining" ? "text-[var(--hack-red)]" : "text-[var(--hack-gray)]"
                }`}>{t.trend}</span>
                <span className={`font-mono text-[8px] ${
                  t.sentiment === "positive" ? "text-[var(--hack-green)]" : t.sentiment === "negative" ? "text-[var(--hack-red)]" : "text-[var(--hack-gray)]"
                }`}>{t.sentiment}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 p-2 text-center">
      <Icon className={`h-3 w-3 mx-auto mb-0.5 ${c}`} />
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[7px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
      active ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]" : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:border-[var(--hack-cyan)]/30"
    }`}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className={`h-3.5 w-3.5 ${c}`} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">{title}</span>
    </div>
  );
}

function SentimentBar({ label, value, color }: { label: string; value: number; color: string }) {
  const c = color === "green" ? "bg-[var(--hack-green)]" : color === "red" ? "bg-[var(--hack-red)]" : "bg-[var(--hack-gray)]";
  const tc = color === "green" ? "text-[var(--hack-green)]" : color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/40 p-1.5">
      <div className="flex items-center justify-between font-mono text-[8px] text-[var(--hack-gray)]/60 mb-0.5">
        <span>{label}</span>
        <span className={tc}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-black/60"><div className={`h-full ${c}`} style={{ width: `${value * 100}%` }} /></div>
    </div>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center h-[400px]">
      <div className="text-center">
        <Icon className="h-8 w-8 text-[var(--hack-gray)]/30 mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]/60">{message}</p>
      </div>
    </div>
  );
}
