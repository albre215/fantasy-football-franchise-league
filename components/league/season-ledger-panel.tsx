"use client";

import { useEffect, useMemo, useState } from "react";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  LeagueMemberSeasonLedgerResponse,
  SeasonLedgerResponse
} from "@/types/ledger";
import type { LeagueBootstrapMember } from "@/types/league";
import type { SeasonSummary } from "@/types/season";

interface SeasonLedgerPanelProps {
  activeSeason: SeasonSummary | null;
  canManageLedger: boolean;
  accessMessage: string | null;
  members: LeagueBootstrapMember[];
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function SeasonLedgerPanel({
  activeSeason,
  canManageLedger,
  accessMessage,
  members,
  onError,
  onSuccess
}: SeasonLedgerPanelProps) {
  const [summary, setSummary] = useState<SeasonLedgerResponse["ledger"] | null>(null);
  const [memberLedger, setMemberLedger] = useState<LeagueMemberSeasonLedgerResponse["ledger"] | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingMember, setIsLoadingMember] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const ownerOptions = useMemo(
    () =>
      summary?.balances.length
        ? summary.balances
        : members.map((member) => ({
            leagueMemberId: member.id,
            userId: member.userId,
            displayName: member.displayName,
            email: member.email,
            role: member.role,
            totalBalance: 0,
            totalPositive: 0,
            totalNegative: 0,
            entryCount: 0
          })),
    [members, summary]
  );

  useEffect(() => {
    setSummary(null);
    setMemberLedger(null);
    setSelectedMemberId("");
    setSummaryError(null);
    setMemberError(null);

    if (!activeSeason) {
      return;
    }

    const seasonId = activeSeason.id;
    let isCancelled = false;

    async function loadSummary() {
      setIsLoadingSummary(true);

      try {
        const response = await fetch(`/api/season/${seasonId}/ledger`, { cache: "no-store" });
        const data = await parseJsonResponse<SeasonLedgerResponse>(response);

        if (!isCancelled) {
          setSummary(data.ledger);
          const defaultMemberId = data.ledger.balances[0]?.leagueMemberId ?? members[0]?.id ?? "";
          setSelectedMemberId(defaultMemberId);
          setSummaryError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setSummary(null);
          setSummaryError(error instanceof Error ? error.message : "Unable to load the season ledger.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSummary(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isCancelled = true;
    };
  }, [activeSeason, members]);

  useEffect(() => {
    if (!activeSeason || !selectedMemberId) {
      setMemberLedger(null);
      return;
    }

    const seasonId = activeSeason.id;
    let isCancelled = false;

    async function loadMemberLedger() {
      setIsLoadingMember(true);

      try {
        const response = await fetch(`/api/season/${seasonId}/ledger/member/${selectedMemberId}`, {
          cache: "no-store"
        });
        const data = await parseJsonResponse<LeagueMemberSeasonLedgerResponse>(response);

        if (!isCancelled) {
          setMemberLedger(data.ledger);
          setMemberError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setMemberLedger(null);
          setMemberError(error instanceof Error ? error.message : "Unable to load owner ledger details.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingMember(false);
        }
      }
    }

    void loadMemberLedger();

    return () => {
      isCancelled = true;
    };
  }, [activeSeason, selectedMemberId]);

  if (!activeSeason) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>Create or activate a season first to review balances and money events.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            The ledger is season-scoped. Once a season is active, balances and manual adjustments will appear here.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Season Ledger</h2>
        <p className="text-muted-foreground">
          Track money events, owner balances, and commissioner adjustments for {activeSeason.name ?? activeSeason.year}.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>League Balances</CardTitle>
            <CardDescription>Season totals grouped by owner, ranked by current net balance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSummary ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="h-20 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
                ))}
              </div>
            ) : summaryError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {summaryError}
              </div>
            ) : summary ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Entries</p>
                    <p className="mt-1 text-2xl font-semibold">{summary.totals.entryCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Total Credits</p>
                    <p className="mt-1 text-2xl font-semibold text-green-600">
                      {formatCurrency(summary.totals.totalPositive)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Total Debits</p>
                    <p className="mt-1 text-2xl font-semibold text-red-600">
                      {formatCurrency(summary.totals.totalNegative)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Net</p>
                    <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.totals.net)}</p>
                  </div>
                </div>

                {summary.balances.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No ledger entries are recorded for this season yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summary.balances.map((balance) => (
                      <button
                        className={`w-full rounded-lg border p-4 text-left ${
                          selectedMemberId === balance.leagueMemberId
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background"
                        }`}
                        key={balance.leagueMemberId}
                        onClick={() => setSelectedMemberId(balance.leagueMemberId)}
                        type="button"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <ProfileAvatar
                              className="h-9 w-9 border-border bg-slate-100 text-slate-700"
                              fallbackClassName="text-xs"
                              imageUrl={balance.profileImageUrl}
                              name={balance.displayName}
                            />
                            <div>
                            <p className="font-medium text-foreground">{balance.displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              {balance.role} • {balance.entryCount} entries
                            </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{formatCurrency(balance.totalBalance)}</p>
                            <p className="text-sm text-muted-foreground">
                              +{formatCurrency(balance.totalPositive)} / {formatCurrency(balance.totalNegative)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Detail</CardTitle>
            <CardDescription>Chronological ledger detail for the selected owner.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setSelectedMemberId(event.target.value)}
              value={selectedMemberId}
            >
              <option value="">Select owner</option>
              {ownerOptions.map((owner) => (
                <option key={owner.leagueMemberId} value={owner.leagueMemberId}>
                  {owner.displayName}
                </option>
              ))}
            </select>

            {isLoadingMember ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="h-20 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
                ))}
              </div>
            ) : memberError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {memberError}
              </div>
            ) : memberLedger ? (
              <>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      className="h-10 w-10 border-border bg-slate-100 text-slate-700"
                      fallbackClassName="text-xs"
                      imageUrl={memberLedger.member.profileImageUrl}
                      name={memberLedger.member.displayName}
                    />
                    <div>
                      <p className="font-medium text-foreground">{memberLedger.member.displayName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{memberLedger.member.email}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Net</p>
                      <p className="text-lg font-semibold">{formatCurrency(memberLedger.totals.net)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Credits</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(memberLedger.totals.totalPositive)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Debits</p>
                      <p className="text-lg font-semibold text-red-600">
                        {formatCurrency(memberLedger.totals.totalNegative)}
                      </p>
                    </div>
                  </div>
                </div>

                {memberLedger.entries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No money events are recorded for this owner yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {memberLedger.entries.map((entry) => (
                      <div className="rounded-lg border border-border bg-background p-4 text-sm" key={entry.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {formatCategory(entry.category)}
                          </span>
                          <span className={entry.amount >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>
                        <p className="mt-3 font-medium text-foreground">{entry.description}</p>
                        <p className="mt-1 text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Select an owner to review their season ledger.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Season Ledger Feed</CardTitle>
            <CardDescription>Most recent money events across the whole league.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingSummary ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div className="h-20 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
              ))
            ) : !summary || summary.entries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No season ledger entries have been recorded yet.
              </div>
            ) : (
              summary.entries.map((entry) => (
                <div className="rounded-lg border border-border bg-background p-4 text-sm" key={entry.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ProfileAvatar
                        className="h-9 w-9 border-border bg-slate-100 text-slate-700"
                        fallbackClassName="text-xs"
                        imageUrl={entry.owner.profileImageUrl}
                        name={entry.owner.displayName}
                      />
                      <div>
                      <p className="font-medium text-foreground">{entry.owner.displayName}</p>
                      <p className="text-muted-foreground">{formatCategory(entry.category)}</p>
                      </div>
                    </div>
                    <p className={entry.amount >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                      {formatCurrency(entry.amount)}
                    </p>
                  </div>
                  <p className="mt-2 text-foreground">{entry.description}</p>
                  <p className="mt-1 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
