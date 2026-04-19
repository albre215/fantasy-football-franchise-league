"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SeasonSummary } from "@/types/season";

type DraftType = "INAUGURAL" | "KEEPER" | "OFFSEASON";

interface DraftScheduleSummary {
  id: string;
  seasonId: string;
  draftType: DraftType;
  scheduledAt: string;
  timezone: string;
}

interface DraftSchedulerProps {
  activeSeason: SeasonSummary | null;
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC"
];

function inferDefaultDraftType(season: SeasonSummary | null): DraftType {
  if (season?.draftMode === "INAUGURAL_AUCTION") return "INAUGURAL";
  if (season?.leaguePhase === "DRAFT_PHASE") return "OFFSEASON";
  return "KEEPER";
}

function splitScheduledAt(iso: string, timezone: string): { date: string; time: string } {
  const date = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`
  };
}

function buildScheduledAtIso(date: string, time: string, timezone: string): string {
  const [hh, mm] = time.split(":").map((value) => Number(value));
  const [y, m, d] = date.split("-").map((value) => Number(value));
  const local = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const tzFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const tzParts = tzFmt.formatToParts(local).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  const offsetMs =
    Date.UTC(
      Number(tzParts.year),
      Number(tzParts.month) - 1,
      Number(tzParts.day),
      Number(tzParts.hour === "24" ? "0" : tzParts.hour),
      Number(tzParts.minute),
      0
    ) - local.getTime();
  return new Date(local.getTime() - offsetMs).toISOString();
}

export function DraftScheduler({ activeSeason }: DraftSchedulerProps) {
  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/Chicago",
    []
  );

  const [schedule, setSchedule] = useState<DraftScheduleSummary | null>(null);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("19:00");
  const [timezone, setTimezone] = useState<string>(browserTz);
  const [draftType, setDraftType] = useState<DraftType>(inferDefaultDraftType(activeSeason));
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inauguralCompleted, setInauguralCompleted] = useState(false);

  const seasonId = activeSeason?.id;

  useEffect(() => {
    if (!seasonId || activeSeason?.draftMode !== "INAUGURAL_AUCTION") {
      setInauguralCompleted(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/season/${seasonId}/inaugural-auction`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { auction?: { auction?: { status?: string } } | null };
        if (!cancelled && payload.auction?.auction?.status === "COMPLETED") {
          setInauguralCompleted(true);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonId, activeSeason?.draftMode]);

  useEffect(() => {
    if (inauguralCompleted && draftType === "INAUGURAL") {
      setDraftType("KEEPER");
    }
  }, [inauguralCompleted, draftType]);

  const loadSchedule = useCallback(async () => {
    if (!seasonId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/season/${seasonId}/draft-schedule`, { cache: "no-store" });
      const payload = (await response.json()) as { schedule: DraftScheduleSummary | null; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load draft schedule.");
      setSchedule(payload.schedule);
      if (payload.schedule) {
        const split = splitScheduledAt(payload.schedule.scheduledAt, payload.schedule.timezone);
        setDate(split.date);
        setTime(split.time);
        setTimezone(payload.schedule.timezone);
        setDraftType(payload.schedule.draftType);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load draft schedule.");
    } finally {
      setIsLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    setDraftType(inferDefaultDraftType(activeSeason));
  }, [activeSeason]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const handleSave = async () => {
    if (!seasonId) return;
    if (!date || !time) {
      setErrorMessage("Pick a date and time.");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const scheduledAt = buildScheduledAtIso(date, time, timezone);
      const response = await fetch(`/api/season/${seasonId}/draft-schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt, timezone, draftType })
      });
      const payload = (await response.json()) as { schedule?: DraftScheduleSummary; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save schedule.");
      if (payload.schedule) setSchedule(payload.schedule);
      setSuccessMessage("Draft schedule saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!seasonId) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`/api/season/${seasonId}/draft-schedule`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to clear schedule.");
      }
      setSchedule(null);
      setDate("");
      setTime("19:00");
      setSuccessMessage("Draft schedule cleared.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to clear schedule.");
    } finally {
      setIsSaving(false);
    }
  };

  const timezoneOptions = useMemo(() => {
    const set = new Set<string>(COMMON_TIMEZONES);
    set.add(browserTz);
    if (schedule) set.add(schedule.timezone);
    return Array.from(set).sort();
  }, [browserTz, schedule]);

  if (inauguralCompleted) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!seasonId ? (
          <p className="text-sm text-muted-foreground">Select an active season to schedule a draft.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Draft type
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoading || isSaving}
                  onChange={(event) => setDraftType(event.target.value as DraftType)}
                  value={draftType}
                >
                  {!inauguralCompleted ? <option value="INAUGURAL">Inaugural auction</option> : null}
                  <option value="KEEPER">Keeper selection</option>
                  <option value="OFFSEASON">Offseason draft</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Timezone
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoading || isSaving}
                  onChange={(event) => setTimezone(event.target.value)}
                  value={timezone}
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Date
                <Input
                  type="date"
                  disabled={isLoading || isSaving}
                  onChange={(event) => setDate(event.target.value)}
                  value={date}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Time
                <Input
                  type="time"
                  disabled={isLoading || isSaving}
                  onChange={(event) => setTime(event.target.value)}
                  value={time}
                />
              </label>
            </div>

            {schedule && new Date(schedule.scheduledAt).getTime() > Date.now() ? (
              <p className="text-sm text-muted-foreground">
                Currently scheduled for{" "}
                <span className="font-medium text-foreground">
                  {new Date(schedule.scheduledAt).toLocaleString(undefined, {
                    timeZone: schedule.timezone,
                    dateStyle: "full",
                    timeStyle: "short"
                  })}
                </span>{" "}
                ({schedule.timezone}).
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No draft currently scheduled.</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={isLoading || isSaving} onClick={handleSave} type="button">
                {isSaving ? "Saving…" : schedule ? "Update schedule" : "Save schedule"}
              </Button>
              {schedule ? (
                <Button
                  disabled={isLoading || isSaving}
                  onClick={handleClear}
                  type="button"
                  variant="outline"
                >
                  Clear schedule
                </Button>
              ) : null}
            </div>

            {errorMessage ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}
            {successMessage ? (
              <p className="text-sm text-emerald-600">{successMessage}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
