"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { NormalizedMatch, StreamSource, NewsArticle } from "@/types";

// ─── Live matches ─────────────────────────────────────────────────────────────

export function useLiveMatches(competitionIds?: string[]) {
  const params = competitionIds?.length
    ? `?competitions=${competitionIds.join(",")}`
    : "";

  return useQuery<NormalizedMatch[]>({
    queryKey: ["matches", "live", competitionIds],
    queryFn: async () => {
      const res = await fetch(`/api/matches/live${params}`);
      if (!res.ok) throw new Error("Failed to fetch live matches");
      const json = await res.json();
      return json.matches ?? [];
    },
    refetchInterval: 15_000, // refresh every 15s for live data
    staleTime: 10_000,
  });
}

// ─── Matches by date ──────────────────────────────────────────────────────────

export function useMatchesByDate(date: string, competitionIds?: string[]) {
  const params = new URLSearchParams({ date });
  if (competitionIds?.length) params.set("competitions", competitionIds.join(","));

  const isToday = date === new Date().toISOString().split("T")[0];

  return useQuery<NormalizedMatch[]>({
    queryKey: ["matches", "date", date, competitionIds],
    queryFn: async () => {
      const res = await fetch(`/api/matches/date?${params}`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      const json = await res.json();
      return json.matches ?? [];
    },
    refetchInterval: isToday ? 30_000 : false,
    staleTime: isToday ? 20_000 : 60 * 60_000,
  });
}

// ─── Single match ─────────────────────────────────────────────────────────────

export function useMatch(
  id: string,
  options: { include?: ("events" | "stats" | "lineups")[] } = {},
) {
  const params = new URLSearchParams();
  if (options.include?.length) params.set("include", options.include.join(","));

  return useQuery<NormalizedMatch>({
    queryKey: ["match", id, options.include],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${id}?${params}`);
      if (!res.ok) throw new Error("Match not found");
      const json = await res.json();
      return json.match;
    },
    enabled: Boolean(id),
    staleTime: 10_000,
    refetchInterval: (query) => {
      const match = query.state.data;
      if (!match) return false;
      const isLive = ["1H", "2H", "HT", "ET", "P"].includes(match.status);
      return isLive ? 15_000 : false;
    },
  });
}

// ─── Streams for a match ──────────────────────────────────────────────────────

export function useMatchStreams(matchId: string) {
  return useQuery<StreamSource[]>({
    queryKey: ["streams", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/streams/${matchId}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.streams ?? [];
    },
    enabled: Boolean(matchId),
    staleTime: 90_000,
    refetchInterval: 120_000,
  });
}

// ─── Prefetch utils ───────────────────────────────────────────────────────────

export function usePrefetchMatch(id: string) {
  const client = useQueryClient();
  return () => {
    client.prefetchQuery({
      queryKey: ["match", id, ["events", "stats", "lineups"]],
      queryFn: () =>
        fetch(`/api/matches/${id}?include=events,stats,lineups`)
          .then((r) => r.json())
          .then((j) => j.match),
      staleTime: 10_000,
    });
  };
}

// ─── Real-time match events via polling ──────────────────────────────────────

export function useMatchEvents(matchId: string, isLive: boolean) {
  return useQuery({
    queryKey: ["match-events", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}?include=events`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.match?.events ?? [];
    },
    enabled: Boolean(matchId),
    refetchInterval: isLive ? 15_000 : false,
    staleTime: isLive ? 10_000 : Infinity,
  });
}

export function useMatchStats(matchId: string, isLive: boolean) {
  return useQuery({
    queryKey: ["match-stats", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}?include=stats`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.match?.stats ?? null;
    },
    enabled: Boolean(matchId),
    refetchInterval: isLive ? 30_000 : false,
    staleTime: isLive ? 20_000 : Infinity,
  });
}

export function useMatchLineups(matchId: string) {
  return useQuery({
    queryKey: ["match-lineups", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}?include=lineups`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.match?.lineups ?? null;
    },
    enabled: Boolean(matchId),
    staleTime: 5 * 60_000, // lineups cache 5min
  });
}
