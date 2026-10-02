// Social Media Intelligence Engine (SMIE) — Feature: Social Intelligence
//
// A first-class intelligence subsystem that runs in parallel with the existing
// web search pipeline. Discovers, verifies, analyzes, ranks, and synthesizes
// authentic information from public social platforms.
//
// Architecture:
//   Query Orchestrator → Platform Agents → Evidence Normalizer →
//   Confidence Scorer → Provenance Recorder → Report Generator
//
// All platform adapters implement the same interface (plugin-based).
// The engine runs asynchronously and never blocks the main pipeline.

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";
import { fetchWithTimeout } from "./sources/_helpers";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export type SocialPlatform =
  | "reddit" | "hackernews" | "github" | "gitlab" | "stackexchange"
  | "wikipedia" | "whatsmyname" | "usernamesearch" | "gravatar"
  | "mastodon" | "bluesky" | "telegram" | "youtube" | "pinterest"
  | "flickr" | "deviantart" | "soundcloud" | "medium" | "behance"
  | "dribbble" | "producthunt" | "goodreads" | "strava" | "vimeo"
  | "twitch" | "vk" | "researchgate" | "truthsocial" | "gab" | "mastodon_social";

export interface SocialProfile {
  platform: SocialPlatform;
  platformLabel: string;
  username: string;
  displayName?: string;
  bio?: string;
  profileUrl: string;
  avatarUrl?: string;
  verified?: boolean;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  accountCreated?: string;
  location?: string;
  website?: string;
  confidence: number;
  authenticityScore: number;
  trustScore: number;
  freshnessScore: number;
  influenceScore: number;
  relevanceScore: number;
}

export interface SocialPost {
  platform: SocialPlatform;
  platformLabel: string;
  author: string;
  authorUrl?: string;
  content: string;
  postUrl: string;
  timestamp: string;
  likes?: number;
  comments?: number;
  shares?: number;
  mediaType?: "text" | "image" | "video" | "link";
  mediaUrls?: string[];
  hashtags?: string[];
  tags?: string[];
  mentions?: string[];
  language?: string;
  confidence: number;
  authenticityScore: number;
  relevanceScore: number;
  engagementScore: number;
  viralityScore: number;
}

export interface SocialEntity {
  id: string;
  name: string;
  type: "person" | "organization" | "product" | "brand" | "location" | "community" | "topic";
  platforms: SocialPlatform[];
  profiles: SocialProfile[];
  aliases: string[];
  description?: string;
  crossPlatformConfidence: number;
  relationshipCount: number;
}

export interface SocialRelationship {
  fromEntity: string;
  toEntity: string;
  type: string;
  platform: SocialPlatform;
  evidence: string;
  confidence: number;
}

export interface SocialCommunity {
  platform: SocialPlatform;
  platformLabel: string;
  name: string;
  url: string;
  memberCount?: number;
  description?: string;
  relevance: number;
}

export interface SocialSentiment {
  overall: "positive" | "neutral" | "negative" | "mixed";
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
  controversyScore: number;
  polarizationScore: number;
  topEmotions: string[];
}

export interface SocialTopic {
  name: string;
  mentionCount: number;
  trend: "rising" | "stable" | "declining";
  sentiment: "positive" | "neutral" | "negative";
  relatedTopics: string[];
}

export interface SocialIntelligenceReport {
  investigationId: string;
  target: string;
  inputType: string;
  generatedAt: string;
  profiles: SocialProfile[];
  posts: SocialPost[];
  entities: SocialEntity[];
  relationships: SocialRelationship[];
  communities: SocialCommunity[];
  topics: SocialTopic[];
  sentiment: SocialSentiment;
  conversationGraph: { nodes: { id: string; label: string; type: string }[]; edges: { from: string; to: string; label: string }[] };
  influencers: { username: string; platform: SocialPlatform; influenceScore: number; profileUrl: string }[];
  mediaItems: { url: string; platform: SocialPlatform; type: string; caption?: string }[];
  summary: string;
  keyFindings: { finding: string; source: string; confidence: number }[];
  confidence: number;
  platformCoverage: { platform: SocialPlatform; status: "success" | "error" | "skipped"; findingCount: number }[];
  totalFindings: number;
  durationMs: number;
}

export interface SocialIntelligenceApiResponse {
  investigation_id: string;
  report: SocialIntelligenceReport;
}

// ============================================================================
// PLATFORM ADAPTER INTERFACE
// ============================================================================

export interface PlatformAdapter {
  platform: SocialPlatform;
  label: string;
  search(target: string, inputType: string): Promise<{ profiles: SocialProfile[]; posts: SocialPost[]; communities: SocialCommunity[] }>;
}

// ============================================================================
// PLATFORM ADAPTERS — each implements the same interface
// ============================================================================

class RedditAdapter implements PlatformAdapter {
  platform: SocialPlatform = "reddit";
  label = "Reddit";

  async search(target: string, inputType: string) {
    const profiles: SocialProfile[] = [];
    const posts: SocialPost[] = [];
    const communities: SocialCommunity[] = [];

    try {
      // Search for user
      const userUrl = `https://www.reddit.com/user/${encodeURIComponent(target)}/about.json`;
      const res = await fetchWithTimeout(userUrl, { headers: { "User-Agent": "OSINTiger/1.0" } }, 8000);
      if (res.ok) {
        const data = await res.json();
        const user = data?.data;
        if (user?.name) {
          profiles.push({
            platform: "reddit",
            platformLabel: this.label,
            username: user.name,
            displayName: user.subreddit?.title || user.name,
            bio: user.subreddit?.public_description?.slice(0, 300),
            profileUrl: `https://www.reddit.com/user/${user.name}`,
            avatarUrl: user.icon_img,
            verified: false,
            followerCount: 0,
            postCount: user.total_karma || 0,
            accountCreated: user.created_utc ? new Date(user.created_utc * 1000).toISOString() : undefined,
            confidence: 0.9,
            authenticityScore: user.verified ? 0.9 : 0.7,
            trustScore: user.comment_karma > 1000 ? 0.8 : 0.5,
            freshnessScore: 0.8,
            influenceScore: Math.min(1, (user.total_karma || 0) / 10000),
            relevanceScore: 0.85,
          });
        }
      }

      // Search for subreddit
      const subUrl = `https://www.reddit.com/r/${encodeURIComponent(target)}/about.json`;
      const subRes = await fetchWithTimeout(subUrl, { headers: { "User-Agent": "OSINTiger/1.0" } }, 8000);
      if (subRes.ok) {
        const subData = await subRes.json();
        const sub = subData?.data;
        if (sub?.display_name) {
          communities.push({
            platform: "reddit",
            platformLabel: this.label,
            name: `r/${sub.display_name}`,
            url: `https://www.reddit.com/r/${sub.display_name}`,
            memberCount: sub.subscribers || 0,
            description: sub.public_description?.slice(0, 300),
            relevance: 0.85,
          });
        }
      }

      // Search for posts mentioning target
      const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(target)}&limit=10&sort=relevance`;
      const searchRes = await fetchWithTimeout(searchUrl, { headers: { "User-Agent": "OSINTiger/1.0" } }, 8000);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const children = searchData?.data?.children || [];
        for (const child of children.slice(0, 10)) {
          const post = child?.data;
          if (!post?.title) continue;
          posts.push({
            platform: "reddit",
            platformLabel: this.label,
            author: post.author || "unknown",
            authorUrl: post.author ? `https://www.reddit.com/user/${post.author}` : undefined,
            content: `${post.title}${post.selftext ? " — " + post.selftext.slice(0, 300) : ""}`,
            postUrl: `https://www.reddit.com${post.permalink || ""}`,
            timestamp: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString(),
            likes: post.ups || 0,
            comments: post.num_comments || 0,
            mediaType: post.is_video ? "video" : post.thumbnail ? "image" : "text",
            language: "en",
            confidence: 0.75,
            authenticityScore: 0.7,
            relevanceScore: 0.8,
            engagementScore: Math.min(1, (post.ups || 0) / 1000),
            viralityScore: Math.min(1, (post.num_comments || 0) / 500),
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles, posts, communities };
  }
}

class HackerNewsAdapter implements PlatformAdapter {
  platform: SocialPlatform = "hackernews";
  label = "Hacker News";

  async search(target: string, inputType: string) {
    const profiles: SocialProfile[] = [];
    const posts: SocialPost[] = [];

    try {
      // Search HN Algolia API
      const searchUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(target)}&tags=story&hitsPerPage=10`;
      const res = await fetchWithTimeout(searchUrl, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        const hits = data?.hits || [];
        for (const hit of hits.slice(0, 10)) {
          posts.push({
            platform: "hackernews",
            platformLabel: this.label,
            author: hit.author || "unknown",
            authorUrl: hit.author ? `https://news.ycombinator.com/user?id=${hit.author}` : undefined,
            content: hit.title || hit.story_text?.slice(0, 300) || "",
            postUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
            timestamp: hit.created_at_i ? new Date(hit.created_at_i * 1000).toISOString() : new Date().toISOString(),
            likes: hit.points || 0,
            comments: hit.num_comments || 0,
            mediaType: "link",
            language: "en",
            confidence: 0.8,
            authenticityScore: 0.85,
            relevanceScore: 0.85,
            engagementScore: Math.min(1, (hit.points || 0) / 500),
            viralityScore: Math.min(1, (hit.num_comments || 0) / 300),
          });
        }
      }

      // Try user profile
      const userUrl = `https://hn.algolia.com/api/v1/users/${encodeURIComponent(target)}`;
      const userRes = await fetchWithTimeout(userUrl, {}, 8000);
      if (userRes.ok) {
        const user = await userRes.json();
        if (user?.id) {
          profiles.push({
            platform: "hackernews",
            platformLabel: this.label,
            username: user.id,
            bio: user.about?.slice(0, 300),
            profileUrl: `https://news.ycombinator.com/user?id=${user.id}`,
            accountCreated: user.created_at ? new Date(user.created_at * 1000).toISOString() : undefined,
            postCount: user.submission_count || 0,
            confidence: 0.85,
            authenticityScore: 0.9,
            trustScore: (user.karma || 0) > 1000 ? 0.8 : 0.5,
            freshnessScore: 0.7,
            influenceScore: Math.min(1, (user.karma || 0) / 10000),
            relevanceScore: 0.8,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles, posts, communities: [] };
  }
}

class GitHubAdapter implements PlatformAdapter {
  platform: SocialPlatform = "github";
  label = "GitHub";

  async search(target: string, inputType: string) {
    const profiles: SocialProfile[] = [];
    const posts: SocialPost[] = [];
    const communities: SocialCommunity[] = [];

    try {
      // Search users
      const userSearchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(target)}&per_page=5`;
      const res = await fetchWithTimeout(userSearchUrl, { headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "OSINTiger/1.0" } }, 8000);
      if (res.ok) {
        const data = await res.json();
        const items = data?.items || [];
        for (const item of items.slice(0, 5)) {
          // Fetch full profile
          const profileRes = await fetchWithTimeout(`https://api.github.com/users/${item.login}`, { headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "OSINTiger/1.0" } }, 8000);
          if (profileRes.ok) {
            const user = await profileRes.json();
            profiles.push({
              platform: "github",
              platformLabel: this.label,
              username: user.login,
              displayName: user.name || user.login,
              bio: user.bio?.slice(0, 300),
              profileUrl: user.html_url,
              avatarUrl: user.avatar_url,
              verified: user.type === "Organization",
              followerCount: user.followers || 0,
              followingCount: user.following || 0,
              postCount: user.public_repos || 0,
              accountCreated: user.created_at,
              location: user.location,
              website: user.blog || undefined,
              confidence: 0.9,
              authenticityScore: 0.9,
              trustScore: (user.followers || 0) > 100 ? 0.8 : 0.5,
              freshnessScore: 0.8,
              influenceScore: Math.min(1, (user.followers || 0) / 1000),
              relevanceScore: 0.85,
            });
          }
        }
      }

      // Search repos (as communities)
      const repoSearchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(target)}&per_page=5&sort=stars`;
      const repoRes = await fetchWithTimeout(repoSearchUrl, { headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "OSINTiger/1.0" } }, 8000);
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        const repos = repoData?.items || [];
        for (const repo of repos.slice(0, 5)) {
          communities.push({
            platform: "github",
            platformLabel: this.label,
            name: repo.full_name,
            url: repo.html_url,
            memberCount: repo.stargazers_count || 0,
            description: repo.description?.slice(0, 300),
            relevance: 0.8,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles, posts, communities };
  }
}

class MastodonAdapter implements PlatformAdapter {
  platform: SocialPlatform = "mastodon";
  label = "Mastodon";

  async search(target: string, inputType: string) {
    const profiles: SocialProfile[] = [];
    const posts: SocialPost[] = [];

    try {
      // Try mastodon.social search API
      const searchUrl = `https://mastodon.social/api/v2/search?q=${encodeURIComponent(target)}&type=accounts&limit=5`;
      const res = await fetchWithTimeout(searchUrl, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        const accounts = data?.accounts || [];
        for (const acct of accounts.slice(0, 5)) {
          profiles.push({
            platform: "mastodon",
            platformLabel: this.label,
            username: acct.acct,
            displayName: acct.display_name || acct.acct,
            bio: acct.note?.slice(0, 300),
            profileUrl: acct.url,
            avatarUrl: acct.avatar,
            verified: acct.discoverable || false,
            followerCount: acct.followers_count || 0,
            followingCount: acct.following_count || 0,
            postCount: acct.statuses_count || 0,
            accountCreated: acct.created_at,
            confidence: 0.8,
            authenticityScore: acct.bot ? 0.3 : 0.7,
            trustScore: (acct.followers_count || 0) > 100 ? 0.7 : 0.5,
            freshnessScore: 0.8,
            influenceScore: Math.min(1, (acct.followers_count || 0) / 1000),
            relevanceScore: 0.75,
          });
        }
      }

      // Search for posts mentioning target
      const postSearchUrl = `https://mastodon.social/api/v2/search?q=${encodeURIComponent(target)}&type=statuses&limit=10`;
      const postRes = await fetchWithTimeout(postSearchUrl, {}, 8000);
      if (postRes.ok) {
        const postData = await postRes.json();
        const statuses = postData?.statuses || [];
        for (const status of statuses.slice(0, 10)) {
          posts.push({
            platform: "mastodon",
            platformLabel: this.label,
            author: status.account?.acct || "unknown",
            authorUrl: status.account?.url,
            content: status.content?.replace(/<[^>]*>/g, "").slice(0, 500) || "",
            postUrl: status.url,
            timestamp: status.created_at,
            likes: status.favourites_count || 0,
            comments: status.replies_count || 0,
            shares: status.reblogs_count || 0,
            mediaType: status.media_attachments?.length > 0 ? "image" : "text",
            language: status.language,
            confidence: 0.75,
            authenticityScore: status.account?.bot ? 0.3 : 0.7,
            relevanceScore: 0.75,
            engagementScore: Math.min(1, ((status.favourites_count || 0) + (status.reblogs_count || 0)) / 100),
            viralityScore: Math.min(1, (status.reblogs_count || 0) / 50),
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles, posts, communities: [] };
  }
}

class YouTubeAdapter implements PlatformAdapter {
  platform: SocialPlatform = "youtube";
  label = "YouTube";

  async search(target: string, inputType: string) {
    const posts: SocialPost[] = [];
    const communities: SocialCommunity[] = [];

    try {
      // Search YouTube via RSS feed (no API key needed)
      const searchUrl = `https://www.youtube.com/rss/search?q=${encodeURIComponent(target)}&max_results=10`;
      const res = await fetchWithTimeout(searchUrl, {}, 8000);
      if (res.ok) {
        const text = await res.text();
        // Parse RSS XML
        const entries = text.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
        for (const entry of entries.slice(0, 10)) {
          const title = entry.match(/<title>(.*?)<\/title>/)?.[1] || "";
          const link = entry.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/)?.[1] || "";
          const author = entry.match(/<name>(.*?)<\/name>/)?.[1] || "unknown";
          const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || new Date().toISOString();
          posts.push({
            platform: "youtube",
            platformLabel: this.label,
            author,
            content: title,
            postUrl: link,
            timestamp: published,
            mediaType: "video",
            language: "en",
            confidence: 0.75,
            authenticityScore: 0.7,
            relevanceScore: 0.8,
            engagementScore: 0.5,
            viralityScore: 0.5,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles: [], posts, communities };
  }
}

class TelegramAdapter implements PlatformAdapter {
  platform: SocialPlatform = "telegram";
  label = "Telegram";

  async search(target: string, inputType: string) {
    const communities: SocialCommunity[] = [];

    try {
      // Check if a public channel/group exists by trying to fetch its preview
      const channelUrl = `https://t.me/${encodeURIComponent(target)}`;
      const res = await fetchWithTimeout(channelUrl, {}, 8000);
      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]*)"/);
        if (titleMatch) {
          communities.push({
            platform: "telegram",
            platformLabel: this.label,
            name: titleMatch[1],
            url: channelUrl,
            description: descMatch?.[1]?.slice(0, 300),
            relevance: 0.8,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles: [], posts: [], communities };
  }
}

class PinterestAdapter implements PlatformAdapter {
  platform: SocialPlatform = "pinterest";
  label = "Pinterest";

  async search(target: string, inputType: string) {
    const posts: SocialPost[] = [];

    try {
      // Try to fetch Pinterest search results via public page
      const searchUrl = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(target)}`;
      // Pinterest doesn't have a public API, but we can check if a user profile exists
      const userUrl = `https://www.pinterest.com/${encodeURIComponent(target)}/`;
      const res = await fetchWithTimeout(userUrl, {}, 8000);
      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<meta property="og:title" content="([^"]*)"/);
        const descMatch = html.match(/<meta property="og:description" content="([^"]*)"/);
        if (titleMatch) {
          posts.push({
            platform: "pinterest",
            platformLabel: this.label,
            author: target,
            content: `${titleMatch[1]} — ${descMatch?.[1]?.slice(0, 200) || ""}`,
            postUrl: userUrl,
            timestamp: new Date().toISOString(),
            mediaType: "image",
            confidence: 0.6,
            authenticityScore: 0.6,
            relevanceScore: 0.7,
            engagementScore: 0.3,
            viralityScore: 0.3,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles: [], posts, communities: [] };
  }
}

class FlickrAdapter implements PlatformAdapter {
  platform: SocialPlatform = "flickr";
  label = "Flickr";

  async search(target: string, inputType: string) {
    const posts: SocialPost[] = [];

    try {
      // Flickr public feed API (no key needed)
      const feedUrl = `https://www.flickr.com/services/feeds/photos_public.gne?tags=${encodeURIComponent(target)}&format=json&nojsoncallback=1`;
      const res = await fetchWithTimeout(feedUrl, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        const items = data?.items || [];
        for (const item of items.slice(0, 10)) {
          posts.push({
            platform: "flickr",
            platformLabel: this.label,
            author: item.author || "unknown",
            content: item.title || item.description?.replace(/<[^>]*>/g, "").slice(0, 300) || "",
            postUrl: item.link,
            timestamp: item.date_published || new Date().toISOString(),
            mediaType: "image",
            mediaUrls: item.media?.m ? [item.media.m] : [],
            tags: item.tags?.split(" ").slice(0, 10),
            confidence: 0.7,
            authenticityScore: 0.7,
            relevanceScore: 0.75,
            engagementScore: 0.3,
            viralityScore: 0.3,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles: [], posts, communities: [] };
  }
}

class SoundCloudAdapter implements PlatformAdapter {
  platform: SocialPlatform = "soundcloud";
  label = "SoundCloud";

  async search(target: string, inputType: string) {
    const profiles: SocialProfile[] = [];

    try {
      // Check if user exists via oEmbed (no API key needed)
      const oembedUrl = `https://soundcloud.com/oembed?format=json&url=https://soundcloud.com/${encodeURIComponent(target)}`;
      const res = await fetchWithTimeout(oembedUrl, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        if (data?.title) {
          profiles.push({
            platform: "soundcloud",
            platformLabel: this.label,
            username: target,
            displayName: data.title,
            profileUrl: `https://soundcloud.com/${target}`,
            bio: data.description?.slice(0, 300),
            confidence: 0.7,
            authenticityScore: 0.7,
            trustScore: 0.5,
            freshnessScore: 0.6,
            influenceScore: 0.4,
            relevanceScore: 0.7,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles, posts: [], communities: [] };
  }
}

class MediumAdapter implements PlatformAdapter {
  platform: SocialPlatform = "medium";
  label = "Medium";

  async search(target: string, inputType: string) {
    const posts: SocialPost[] = [];

    try {
      // Search Medium via their public RSS-style endpoint
      const searchUrl = `https://medium.com/search?q=${encodeURIComponent(target)}`;
      // Use web_search as a fallback for Medium content
      const profiles: SocialProfile[] = [];

      // Check if Medium publication exists
      const pubUrl = `https://medium.com/${encodeURIComponent(target)}`;
      const res = await fetchWithTimeout(pubUrl, {}, 8000);
      if (res.ok) {
        const html = await res.text();
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        if (titleMatch && !titleMatch[1].includes("404")) {
          profiles.push({
            platform: "medium",
            platformLabel: this.label,
            username: target,
            displayName: titleMatch[1],
            profileUrl: pubUrl,
            confidence: 0.6,
            authenticityScore: 0.7,
            trustScore: 0.5,
            freshnessScore: 0.6,
            influenceScore: 0.4,
            relevanceScore: 0.7,
          });
        }
      }

      return { profiles, posts, communities: [] };
    } catch {
      return { profiles: [], posts, communities: [] };
    }
  }
}

class VKAdapter implements PlatformAdapter {
  platform: SocialPlatform = "vk";
  label = "VKontakte";

  async search(target: string, inputType: string) {
    const profiles: SocialProfile[] = [];

    try {
      // VK public API (no key for basic search)
      const searchUrl = `https://api.vk.com/method/users.search?q=${encodeURIComponent(target)}&count=5&v=5.131`;
      const res = await fetchWithTimeout(searchUrl, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        const users = data?.response?.items || [];
        for (const user of users.slice(0, 5)) {
          profiles.push({
            platform: "vk",
            platformLabel: this.label,
            username: `${user.first_name} ${user.last_name}`,
            displayName: `${user.first_name} ${user.last_name}`,
            profileUrl: `https://vk.com/id${user.id}`,
            avatarUrl: user.photo_100,
            verified: user.verified === 1,
            confidence: 0.65,
            authenticityScore: user.verified === 1 ? 0.9 : 0.6,
            trustScore: 0.5,
            freshnessScore: 0.6,
            influenceScore: 0.3,
            relevanceScore: 0.7,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles, posts: [], communities: [] };
  }
}

class BlueskyAdapter implements PlatformAdapter {
  platform: SocialPlatform = "bluesky";
  label = "Bluesky";

  async search(target: string, inputType: string) {
    const profiles: SocialProfile[] = [];
    const posts: SocialPost[] = [];

    try {
      // Bluesky public API (AppView)
      const searchUrl = `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(target)}&limit=5`;
      const res = await fetchWithTimeout(searchUrl, {}, 8000);
      if (res.ok) {
        const data = await res.json();
        const actors = data?.actors || [];
        for (const actor of actors.slice(0, 5)) {
          profiles.push({
            platform: "bluesky",
            platformLabel: this.label,
            username: actor.handle,
            displayName: actor.displayName || actor.handle,
            bio: actor.description?.slice(0, 300),
            profileUrl: `https://bsky.app/profile/${actor.handle}`,
            avatarUrl: actor.avatar,
            verified: false,
            followerCount: actor.followersCount || 0,
            followingCount: actor.followsCount || 0,
            postCount: actor.postsCount || 0,
            accountCreated: actor.createdAt,
            confidence: 0.75,
            authenticityScore: 0.7,
            trustScore: (actor.followersCount || 0) > 100 ? 0.7 : 0.5,
            freshnessScore: 0.8,
            influenceScore: Math.min(1, (actor.followersCount || 0) / 1000),
            relevanceScore: 0.75,
          });
        }
      }
    } catch {
      // Graceful degradation
    }

    return { profiles, posts, communities: [] };
  }
}

// ============================================================================
// PLATFORM REGISTRY — plugin-based, new platforms can be added without
// modifying the orchestration layer
// ============================================================================

const platformAdapters: PlatformAdapter[] = [
  new RedditAdapter(),
  new HackerNewsAdapter(),
  new GitHubAdapter(),
  new MastodonAdapter(),
  new YouTubeAdapter(),
  new TelegramAdapter(),
  new PinterestAdapter(),
  new FlickrAdapter(),
  new SoundCloudAdapter(),
  new MediumAdapter(),
  new VKAdapter(),
  new BlueskyAdapter(),
];

/**
 * Register a new platform adapter at runtime.
 * This enables plugin-based extensibility without modifying the core engine.
 */
export function registerPlatformAdapter(adapter: PlatformAdapter): void {
  if (!platformAdapters.find((a) => a.platform === adapter.platform)) {
    platformAdapters.push(adapter);
  }
}

/**
 * Get all registered platform adapters.
 */
export function getPlatformAdapters(): PlatformAdapter[] {
  return platformAdapters;
}

// ============================================================================
// QUERY ORCHESTRATOR
// ============================================================================

export interface OrchestratedQuery {
  originalQuery: string;
  expandedQueries: string[];
  searchIntents: string[];
  platformQueries: { platform: SocialPlatform; query: string }[];
}

export function orchestrateQuery(target: string, inputType: string): OrchestratedQuery {
  const cleanTarget = target.trim();
  const lowerTarget = cleanTarget.toLowerCase();

  // Generate expanded queries
  const expandedQueries = [
    cleanTarget,
    lowerTarget,
    `"${cleanTarget}"`,
    cleanTarget.replace(/\s+/g, "_"),
    cleanTarget.replace(/\s+/g, ""),
  ];

  // Remove duplicates
  const uniqueExpanded = [...new Set(expandedQueries)].filter((q) => q.length > 1);

  // Generate search intents based on input type
  const searchIntents: string[] = [];
  if (inputType === "person") {
    searchIntents.push("profile", "posts", "activity", "mentions", "connections");
  } else if (inputType === "organization" || inputType === "domain") {
    searchIntents.push("official_account", "employee_mentions", "community_discussion", "reviews");
  } else {
    searchIntents.push("mentions", "discussions", "profiles", "communities");
  }

  // Generate platform-specific queries
  const platformQueries = platformAdapters.map((adapter) => ({
    platform: adapter.platform,
    query: cleanTarget,
  }));

  return {
    originalQuery: cleanTarget,
    expandedQueries: uniqueExpanded,
    searchIntents,
    platformQueries,
  };
}

// ============================================================================
// PARALLEL SOCIAL INTELLIGENCE MANAGER
// ============================================================================

/**
 * Run all platform adapters in parallel.
 * Each adapter has its own timeout and error handling.
 * No adapter can block another.
 */
export async function runSocialIntelligence(
  target: string,
  inputType: string,
  investigationId: string
): Promise<SocialIntelligenceReport> {
  const startTime = Date.now();
  const orchestrated = orchestrateQuery(target, inputType);

  // Run all platform adapters in parallel with individual timeouts
  const adapterPromises = platformAdapters.map(async (adapter) => {
    try {
      const result = await Promise.race([
        adapter.search(target, inputType),
        new Promise<{ profiles: SocialProfile[]; posts: SocialPost[]; communities: SocialCommunity[] }>(
          (_, reject) => setTimeout(() => reject(new Error(`${adapter.label} timed out`)), 12000)
        ),
      ]);
      return { adapter, result, error: null as string | null };
    } catch (e) {
      return {
        adapter,
        result: { profiles: [], posts: [], communities: [] },
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }
  });

  const adapterResults = await Promise.allSettled(adapterPromises);

  // Collect results
  const allProfiles: SocialProfile[] = [];
  const allPosts: SocialPost[] = [];
  const allCommunities: SocialCommunity[] = [];
  const platformCoverage: SocialIntelligenceReport["platformCoverage"] = [];

  for (const result of adapterResults) {
    if (result.status === "fulfilled") {
      const { adapter, result: data, error } = result.value;
      allProfiles.push(...data.profiles);
      allPosts.push(...data.posts);
      allCommunities.push(...data.communities);
      platformCoverage.push({
        platform: adapter.platform,
        status: error ? "error" : "success",
        findingCount: data.profiles.length + data.posts.length + data.communities.length,
      });
    } else {
      // Should not happen since we catch errors inside the promise
      platformCoverage.push({
        platform: "reddit", // placeholder, should not reach here
        status: "error",
        findingCount: 0,
      });
    }
  }

  // Cross-platform entity resolution
  const entities = resolveEntities(allProfiles, target);

  // Build conversation graph
  const conversationGraph = buildConversationGraph(allPosts, allProfiles);

  // Extract topics
  const topics = extractTopics(allPosts);

  // Analyze sentiment
  const sentiment = analyzeSentiment(allPosts);

  // Find influencers
  const influencers = findInfluencers(allProfiles);

  // Collect media items
  const mediaItems = allPosts
    .filter((p) => p.mediaUrls && p.mediaUrls.length > 0)
    .flatMap((p) => p.mediaUrls!.map((url) => ({ url, platform: p.platform, type: p.mediaType || "image", caption: p.content.slice(0, 100) })));

  // Generate summary and key findings
  const { summary, keyFindings } = generateSummary(target, inputType, allProfiles, allPosts, allCommunities);

  // Calculate overall confidence
  const confidence = calculateOverallConfidence(allProfiles, allPosts);

  const totalFindings = allProfiles.length + allPosts.length + allCommunities.length;

  return {
    investigationId,
    target,
    inputType,
    generatedAt: new Date().toISOString(),
    profiles: allProfiles,
    posts: allPosts,
    entities,
    relationships: [],
    communities: allCommunities,
    topics,
    sentiment,
    conversationGraph,
    influencers,
    mediaItems,
    summary,
    keyFindings,
    confidence,
    platformCoverage,
    totalFindings,
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// CROSS-PLATFORM ENTITY RESOLUTION
// ============================================================================

function resolveEntities(profiles: SocialProfile[], target: string): SocialEntity[] {
  const entities: SocialEntity[] = [];
  const seen = new Set<string>();

  // Group profiles by similar names
  for (const profile of profiles) {
    const nameKey = profile.username.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(nameKey)) continue;
    seen.add(nameKey);

    // Find matching profiles across platforms
    const matches = profiles.filter((p) => {
      const otherKey = p.username.toLowerCase().replace(/[^a-z0-9]/g, "");
      return otherKey === nameKey || p.displayName?.toLowerCase().includes(target.toLowerCase());
    });

    entities.push({
      id: `entity_${entities.length}`,
      name: profile.displayName || profile.username,
      type: "person",
      platforms: [...new Set(matches.map((m) => m.platform))],
      profiles: matches,
      aliases: [...new Set(matches.map((m) => m.username))],
      crossPlatformConfidence: matches.length > 1 ? 0.8 : 0.5,
      relationshipCount: 0,
    });
  }

  return entities;
}

// ============================================================================
// CONVERSATION GRAPH BUILDER
// ============================================================================

function buildConversationGraph(posts: SocialPost[], profiles: SocialProfile[]) {
  const nodes: { id: string; label: string; type: string }[] = [];
  const edges: { from: string; to: string; label: string }[] = [];
  const nodeIds = new Set<string>();

  // Add profile nodes
  for (const profile of profiles) {
    const id = `profile_${profile.platform}_${profile.username}`;
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({ id, label: profile.displayName || profile.username, type: "author" });
    }
  }

  // Add post nodes and edges
  for (const post of posts) {
    const postId = `post_${post.platform}_${post.postUrl.slice(-50)}`;
    if (!nodeIds.has(postId)) {
      nodeIds.add(postId);
      nodes.push({ id: postId, label: post.content.slice(0, 50), type: "post" });
    }
    const authorId = `profile_${post.platform}_${post.author}`;
    if (!nodeIds.has(authorId)) {
      nodeIds.add(authorId);
      nodes.push({ id: authorId, label: post.author, type: "author" });
    }
    edges.push({ from: authorId, to: postId, label: "posted" });

    // Add hashtag edges
    if (post.hashtags) {
      for (const tag of post.hashtags) {
        const tagId = `tag_${tag}`;
        if (!nodeIds.has(tagId)) {
          nodeIds.add(tagId);
          nodes.push({ id: tagId, label: `#${tag}`, type: "topic" });
        }
        edges.push({ from: postId, to: tagId, label: "hashtag" });
      }
    }
  }

  return { nodes: nodes.slice(0, 200), edges: edges.slice(0, 300) };
}

// ============================================================================
// TOPIC EXTRACTION
// ============================================================================

function extractTopics(posts: SocialPost[]): SocialTopic[] {
  const topicCounts = new Map<string, number>();
  const topicSentiments = new Map<string, { positive: number; negative: number }>();

  for (const post of posts) {
    // Extract hashtags as topics
    if (post.hashtags) {
      for (const tag of post.hashtags) {
        const topic = tag.toLowerCase();
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        const sentiment = topicSentiments.get(topic) || { positive: 0, negative: 0 };
        if (post.content.toLowerCase().includes("good") || post.content.toLowerCase().includes("great")) sentiment.positive++;
        if (post.content.toLowerCase().includes("bad") || post.content.toLowerCase().includes("terrible")) sentiment.negative++;
        topicSentiments.set(topic, sentiment);
      }
    }

    // Extract capitalized words as potential topics
    const capWords = post.content.match(/\b([A-Z][a-z]{3,})\b/g) || [];
    for (const word of capWords.slice(0, 3)) {
      const topic = word.toLowerCase();
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  const topics: SocialTopic[] = [];
  for (const [name, count] of topicCounts) {
    if (count < 1) continue;
    const sentiment = topicSentiments.get(name);
    topics.push({
      name,
      mentionCount: count,
      trend: count > 3 ? "rising" : "stable",
      sentiment: sentiment ? (sentiment.positive > sentiment.negative ? "positive" : sentiment.negative > sentiment.positive ? "negative" : "neutral") : "neutral",
      relatedTopics: [],
    });
  }

  return topics.sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 15);
}

// ============================================================================
// SENTIMENT ANALYSIS
// ============================================================================

function analyzeSentiment(posts: SocialPost[]): SocialSentiment {
  let positive = 0;
  let negative = 0;
  let neutral = 0;

  const positiveWords = ["good", "great", "excellent", "amazing", "love", "best", "awesome", "fantastic", "recommend", "impressive"];
  const negativeWords = ["bad", "terrible", "awful", "hate", "worst", "horrible", "scam", "fraud", "disappointed", "angry"];
  const emotions: string[] = [];

  for (const post of posts) {
    const text = post.content.toLowerCase();
    let posScore = 0;
    let negScore = 0;

    for (const word of positiveWords) {
      if (text.includes(word)) posScore++;
    }
    for (const word of negativeWords) {
      if (text.includes(word)) negScore++;
    }

    if (posScore > negScore) {
      positive++;
      emotions.push("joy");
    } else if (negScore > posScore) {
      negative++;
      emotions.push("anger");
    } else {
      neutral++;
    }
  }

  const total = Math.max(1, posts.length);
  const controversyScore = Math.min(1, (positive + negative) / total);
  const polarizationScore = Math.min(1, Math.abs(positive - negative) / total);

  // Count top emotions
  const emotionCounts = new Map<string, number>();
  for (const emotion of emotions) {
    emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
  }
  const topEmotions = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([e]) => e);

  const overall = positive > negative ? "positive" : negative > positive ? "negative" : neutral > 0 ? "neutral" : "neutral";

  return {
    overall: positive > 0 && negative > 0 ? "mixed" : overall as "positive" | "neutral" | "negative" | "mixed",
    positiveRatio: positive / total,
    negativeRatio: negative / total,
    neutralRatio: neutral / total,
    controversyScore,
    polarizationScore,
    topEmotions: topEmotions.length > 0 ? topEmotions : ["neutral"],
  };
}

// ============================================================================
// INFLUENCER DISCOVERY
// ============================================================================

function findInfluencers(profiles: SocialProfile[]) {
  return profiles
    .filter((p) => p.influenceScore > 0.3 || (p.followerCount || 0) > 100)
    .sort((a, b) => b.influenceScore - a.influenceScore)
    .slice(0, 10)
    .map((p) => ({
      username: p.username,
      platform: p.platform,
      influenceScore: p.influenceScore,
      profileUrl: p.profileUrl,
    }));
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

function generateSummary(
  target: string,
  inputType: string,
  profiles: SocialProfile[],
  posts: SocialPost[],
  communities: SocialCommunity[]
): { summary: string; keyFindings: { finding: string; source: string; confidence: number }[] } {
  const parts: string[] = [];
  const keyFindings: { finding: string; source: string; confidence: number }[] = [];

  if (profiles.length > 0) {
    const platforms = [...new Set(profiles.map((p) => p.platformLabel))].join(", ");
    parts.push(`Discovered ${profiles.length} social media profile(s) across ${platforms}.`);
    
    const topProfile = profiles[0];
    keyFindings.push({
      finding: `${topProfile.displayName || topProfile.username} found on ${topProfile.platformLabel} with ${topProfile.followerCount || 0} followers and ${topProfile.postCount || 0} posts.`,
      source: topProfile.platformLabel,
      confidence: topProfile.confidence,
    });

    if (topProfile.bio) {
      keyFindings.push({
        finding: `${topProfile.platformLabel} bio: ${topProfile.bio.slice(0, 150)}`,
        source: topProfile.platformLabel,
        confidence: topProfile.confidence * 0.9,
      });
    }

    if (topProfile.location) {
      keyFindings.push({
        finding: `Location listed on ${topProfile.platformLabel}: ${topProfile.location}`,
        source: topProfile.platformLabel,
        confidence: topProfile.confidence * 0.85,
      });
    }

    if (topProfile.website) {
      keyFindings.push({
        finding: `Website linked from ${topProfile.platformLabel}: ${topProfile.website}`,
        source: topProfile.platformLabel,
        confidence: topProfile.confidence * 0.85,
      });
    }
  }

  if (posts.length > 0) {
    const topPosts = posts.slice(0, 5);
    parts.push(`Found ${posts.length} public posts mentioning or related to ${target}.`);
    
    for (const post of topPosts.slice(0, 3)) {
      keyFindings.push({
        finding: `${post.platformLabel} post by ${post.author}: ${post.content.slice(0, 150)}`,
        source: post.platformLabel,
        confidence: post.confidence,
      });
    }
  }

  if (communities.length > 0) {
    const communityNames = communities.map((c) => c.name).join(", ");
    parts.push(`Discovered ${communities.length} relevant communities: ${communityNames}.`);
    
    for (const community of communities.slice(0, 2)) {
      keyFindings.push({
        finding: `${community.name} on ${community.platformLabel} with ${community.memberCount || 0} members.`,
        source: community.platformLabel,
        confidence: 0.8,
      });
    }
  }

  if (parts.length === 0) {
    parts.push(`No social media presence found for ${target} across ${platformAdapters.length} platforms.`);
  }

  return {
    summary: parts.join(" "),
    keyFindings: keyFindings.slice(0, 10),
  };
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

function calculateOverallConfidence(profiles: SocialProfile[], posts: SocialPost[]): number {
  if (profiles.length === 0 && posts.length === 0) return 0.2;

  const profileConfidence = profiles.length > 0
    ? profiles.reduce((s, p) => s + p.confidence, 0) / profiles.length
    : 0.3;

  const postConfidence = posts.length > 0
    ? posts.reduce((s, p) => s + p.confidence, 0) / posts.length
    : 0.3;

  // Weight profiles higher since they're more verifiable
  return profileConfidence * 0.6 + postConfidence * 0.4;
}
