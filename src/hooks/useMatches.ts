"use client";

import { useQuery } from '@tanstack/react-query';
import { Commentary, NormalizedLineup, NormalizedMatch, NormalizedMatchEvent, NormalizedMatchStats, StreamSource } from '@/types';

export function useMatches() {
  return useQuery<NormalizedMatch[]>({
    queryKey: ['liveMatches'],
    queryFn: async () => {
      const res = await fetch('/api/matches/live');
      if (!res.ok) throw new Error('Failed to fetch live matches');
      const data = await res.json();
      return data.matches as NormalizedMatch[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

// Alias for backwards compatibility with original ScoresDashboard
export const useLiveMatches = useMatches;

export function useMatchesByDate(date: string) {
  const timezone = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  return useQuery<NormalizedMatch[]>({
    queryKey: ['matchesByDate', date, timezone],
    queryFn: async () => {
      const res = await fetch(`/api/matches/date?date=${date}&timezone=${encodeURIComponent(timezone)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.matches ?? []) as NormalizedMatch[];
    },
    enabled: Boolean(date),
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  });
}


interface UseMatchOptions {
  include?: Array<'events' | 'stats' | 'lineups'>;
}

export function useMatch(matchId: string, options: UseMatchOptions = {}) {
  const include = options.include?.join(',');

  return useQuery<NormalizedMatch | null>({
    queryKey: ['match', matchId, include ?? 'summary'],
    queryFn: async () => {
      const decodedId = decodeURIComponent(matchId);
      const params = include ? `?include=${encodeURIComponent(include)}` : '';
      const res = await fetch(`/api/matches/${encodeURIComponent(decodedId)}${params}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.match as NormalizedMatch;
    },
    enabled: Boolean(matchId),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useMatchEvents(matchId: string, isLive = false) {
  return useQuery<NormalizedMatchEvent[]>({
    queryKey: ['match-events', matchId],
    queryFn: async () => {
      const decodedId = decodeURIComponent(matchId);
      const res = await fetch(`/api/matches/${encodeURIComponent(decodedId)}?include=events`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.match?.events ?? []) as NormalizedMatchEvent[];
    },
    enabled: Boolean(matchId),
    staleTime: isLive ? 15 * 1000 : 5 * 60 * 1000,
    refetchInterval: isLive ? 20 * 1000 : false,
  });
}

export function useMatchStats(matchId: string, isLive = false) {
  return useQuery<NormalizedMatchStats[]>({
    queryKey: ['match-stats', matchId],
    queryFn: async () => {
      const decodedId = decodeURIComponent(matchId);
      const res = await fetch(`/api/matches/${encodeURIComponent(decodedId)}?include=stats`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.match?.stats ?? []) as NormalizedMatchStats[];
    },
    enabled: Boolean(matchId),
    staleTime: isLive ? 20 * 1000 : 5 * 60 * 1000,
    refetchInterval: isLive ? 30 * 1000 : false,
  });
}

export function useMatchLineups(matchId: string) {
  return useQuery<NormalizedLineup[]>({
    queryKey: ['match-lineups', matchId],
    queryFn: async () => {
      const decodedId = decodeURIComponent(matchId);
      const res = await fetch(`/api/matches/${encodeURIComponent(decodedId)}?include=lineups`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.match?.lineups ?? []) as NormalizedLineup[];
    },
    enabled: Boolean(matchId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMatchStreams(matchId: string) {
  return useQuery<StreamSource[]>({
    queryKey: ['match-streams', matchId],
    queryFn: async () => {
      const decodedId = decodeURIComponent(matchId);
      const res = await fetch(`/api/streams/${encodeURIComponent(decodedId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.streams ?? []).map(normalizeStream) as StreamSource[];
    },
    enabled: Boolean(matchId),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useMatchCommentary(matchId: string, isLive = false) {
  return useQuery<Commentary[]>({
    queryKey: ['commentary', matchId],
    queryFn: async () => {
      const decodedId = decodeURIComponent(matchId);
      const res = await fetch(`/api/commentary/${encodeURIComponent(decodedId)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.commentary ?? []) as Commentary[];
    },
    enabled: Boolean(matchId),
    staleTime: isLive ? 8 * 1000 : Infinity,
    refetchInterval: isLive ? 12 * 1000 : false,
  });
}

function normalizeStream(raw: any): StreamSource {
  return {
    id: String(raw.id),
    matchId: String(raw.matchId ?? raw.match_id ?? ''),
    broadcaster: String(raw.broadcaster ?? raw.name ?? 'Unknown broadcaster'),
    broadcasterId: String(raw.broadcasterId ?? raw.broadcaster_id ?? raw.id),
    title: String(raw.title ?? raw.broadcaster ?? 'Live stream'),
    url: String(raw.url ?? '#'),
    embedUrl: raw.embedUrl ?? raw.embed_url ?? null,
    streamType: raw.streamType ?? raw.stream_type ?? 'live',
    quality: raw.quality ?? 'HD',
    language: raw.language ?? 'en',
    region: raw.region ?? raw.regions ?? [],
    isOfficial: raw.isOfficial ?? raw.is_official ?? true,
    isGeoRestricted: raw.isGeoRestricted ?? raw.is_geo_restricted ?? false,
    requiresAuth: raw.requiresAuth ?? raw.requires_auth ?? false,
    requiresSubscription: raw.requiresSubscription ?? raw.requires_subscription ?? false,
    isFree: raw.isFree ?? raw.is_free ?? true,
    isAvailable: raw.isAvailable ?? raw.is_available ?? false,
    availableFrom: raw.availableFrom ?? raw.available_from ?? null,
    availableUntil: raw.availableUntil ?? raw.available_until ?? null,
    lastVerified: raw.lastVerified ?? raw.last_verified ?? new Date().toISOString(),
    thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnail_url ?? null,
    platform: raw.platform ?? 'web',
  };
}
