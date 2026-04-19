"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DraftType = "INAUGURAL" | "KEEPER" | "OFFSEASON";

interface DraftScheduleSummary {
  id: string;
  seasonId: string;
  draftType: DraftType;
  scheduledAt: string;
  timezone: string;
}

interface DraftScheduleBannerProps {
  seasonId: string | null;
  leagueId: string;
  isCommissioner: boolean;
}

const LOBBY_OPEN_MS = 30 * 60 * 1000;

function draftTypeLabel(type: DraftType): string {
  if (type === "INAUGURAL") return "Inaugural Auction";
  if (type === "KEEPER") return "Keeper Selection";
  return "Offseason Draft";
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function DraftScheduleBanner({ seasonId, leagueId, isCommissioner }: DraftScheduleBannerProps) {
  const handleEnterLobby = useCallback(() => {
    const url = `/league/draft-lobby?leagueId=${encodeURIComponent(leagueId)}`;
    const opened = window.open(url, `draft-lobby-${leagueId}`, "width=1400,height=900,noopener=no");
    if (!opened) {
      window.location.href = url;
    } else {
      opened.focus();
    }
  }, [leagueId]);

  const [schedule, setSchedule] = useState<DraftScheduleSummary | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const autoStartFiredRef = useRef(false);

  const loadSchedule = useCallback(async () => {
    if (!seasonId) {
      setSchedule(null);
      return;
    }
    try {
      const response = await fetch(`/api/season/${seasonId}/draft-schedule`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { schedule: DraftScheduleSummary | null };
      setSchedule(payload.schedule);
    } catch {
      // swallow; banner is non-critical
    }
  }, [seasonId]);

  useEffect(() => {
    void loadSchedule();
    const id = window.setInterval(() => void loadSchedule(), 30_000);
    return () => window.clearInterval(id);
  }, [loadSchedule]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!schedule || !isCommissioner || !seasonId) return;
    if (schedule.draftType !== "INAUGURAL") return;
    if (autoStartFiredRef.current) return;
    const startAt = new Date(schedule.scheduledAt).getTime();
    if (now < startAt) return;
    autoStartFiredRef.current = true;
    void fetch(`/api/season/${seasonId}/inaugural-auction/start`, { method: "POST" }).catch(() => {
      // auction may already be active or not configured; ignore
    });
  }, [schedule, isCommissioner, seasonId, now]);

  if (!schedule) return null;

  const startAt = new Date(schedule.scheduledAt).getTime();
  const msUntil = startAt - now;
  const lobbyOpen = msUntil <= LOBBY_OPEN_MS;
  const isLive = msUntil <= 0;
  const label = draftTypeLabel(schedule.draftType);
  const whenText = new Date(schedule.scheduledAt).toLocaleString(undefined, {
    timeZone: schedule.timezone,
    dateStyle: "full",
    timeStyle: "short"
  });

  return (
    <Card className="border-emerald-300 bg-gradient-to-r from-emerald-50 via-emerald-50 to-white shadow-[0_18px_36px_-24px_rgba(6,78,59,0.35)]">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {isLive ? `${label} — Live` : `${label} Scheduled`}
          </p>
          <p className="text-base font-semibold text-emerald-950">
            {isLive ? "The draft is live now." : whenText}
          </p>
          <p className="text-sm text-emerald-800">
            {isLive
              ? "Join the lobby to participate."
              : lobbyOpen
              ? `Lobby open — starts in ${formatCountdown(msUntil)}`
              : `Lobby opens 30 minutes before — ${formatCountdown(msUntil)} remaining`}
          </p>
        </div>
        <Button
          disabled={!lobbyOpen}
          onClick={handleEnterLobby}
          type="button"
          className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-200 disabled:text-emerald-700"
        >
          {isLive ? "Enter Draft Lobby" : lobbyOpen ? "Enter Draft Lobby" : "Lobby opens at T-30:00"}
        </Button>
      </CardContent>
    </Card>
  );
}
