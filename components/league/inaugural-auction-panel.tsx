"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  ConfigureInauguralAuctionResponse,
  InauguralAuctionOrderMethod,
  InauguralAuctionState,
  InauguralAuctionStateResponse,
  StartInauguralAuctionResponse,
  SubmitInauguralBidResponse
} from "@/types/inaugural-auction";
import type { SeasonSummary } from "@/types/season";

const DEFAULT_DIVISION_ORDER = [
  "AFC East",
  "AFC North",
  "AFC South",
  "AFC West",
  "NFC East",
  "NFC North",
  "NFC South",
  "NFC West"
];

interface InauguralAuctionPanelProps {
  activeSeason: SeasonSummary | null;
  title?: string;
  description?: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(0)}`;
}

export function InauguralAuctionPanel({
  activeSeason,
  title = "Inaugural Auction Draft",
  description = "Run the live inaugural auction, track budgets, and finalize first-season ownership."
}: InauguralAuctionPanelProps) {
  const router = useRouter();
  const [auctionState, setAuctionState] = useState<InauguralAuctionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [orderMethod, setOrderMethod] = useState<InauguralAuctionOrderMethod>("ALPHABETICAL");
  const [divisionOrder, setDivisionOrder] = useState<string[]>(DEFAULT_DIVISION_ORDER);
  const [bidAmount, setBidAmount] = useState("1");
  const [visibleAwardId, setVisibleAwardId] = useState<string | null>(null);
  const [showFinalSummary, setShowFinalSummary] = useState(false);

  async function refreshAuctionState() {
    if (!activeSeason) {
      setAuctionState(null);
      return;
    }

    const response = await fetch(`/api/season/${activeSeason.id}/inaugural-auction`, {
      cache: "no-store"
    });
    const data = await parseJsonResponse<InauguralAuctionStateResponse>(response);
    setAuctionState(data.auction);
  }

  useEffect(() => {
    if (!activeSeason) {
      setAuctionState(null);
      setErrorMessage(null);
      return;
    }

    void (async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        await refreshAuctionState();
      } catch (error) {
        setAuctionState(null);
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the inaugural auction.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeSeason?.id]);

  useEffect(() => {
    if (!auctionState) {
      return;
    }

    if (auctionState.activeAward?.id) {
      setVisibleAwardId(auctionState.activeAward.id);
    }
  }, [auctionState?.activeAward?.id]);

  useEffect(() => {
    if (!auctionState?.finalSummary) {
      setShowFinalSummary(false);
      return;
    }

    if (!auctionState.activeAward) {
      setShowFinalSummary(true);
    }
  }, [auctionState?.finalSummary, auctionState?.activeAward]);

  useEffect(() => {
    if (!activeSeason || !auctionState) {
      return;
    }

    if (auctionState.auction.status !== "ACTIVE" && !auctionState.activeAward) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshAuctionState().catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Unable to refresh the inaugural auction.");
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeSeason?.id, auctionState?.auction.status, auctionState?.activeAward?.id]);

  const viewer = auctionState?.viewer ?? null;
  const minimumNextBid = useMemo(() => {
    if (!auctionState?.currentHighBid) {
      return 1;
    }

    return auctionState.currentHighBid.amount + 1;
  }, [auctionState?.currentHighBid?.amount]);

  async function handleConfigureAuction() {
    if (!activeSeason) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await fetch(`/api/season/${activeSeason.id}/inaugural-auction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderMethod,
          divisionOrder: orderMethod === "DIVISION" ? divisionOrder : undefined
        })
      });
      const data = await parseJsonResponse<ConfigureInauguralAuctionResponse>(response);
      setAuctionState(data.auction);
      setSuccessMessage("Inaugural auction order saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to configure the inaugural auction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStartAuction() {
    if (!activeSeason) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await fetch(`/api/season/${activeSeason.id}/inaugural-auction/start`, {
        method: "POST"
      });
      const data = await parseJsonResponse<StartInauguralAuctionResponse>(response);
      setAuctionState(data.auction);
      setSuccessMessage("Inaugural auction started.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start the inaugural auction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitBid() {
    if (!activeSeason) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await fetch(`/api/season/${activeSeason.id}/inaugural-auction/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Number(bidAmount)
        })
      });
      const data = await parseJsonResponse<SubmitInauguralBidResponse>(response);
      setAuctionState(data.auction);
      setSuccessMessage("Bid submitted.");
      setBidAmount(String(Math.max(minimumNextBid + 1, 1)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit the bid.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function moveDivision(index: number, direction: -1 | 1) {
    setDivisionOrder((current) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  if (!activeSeason) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
          {isLoading ? <p className="text-sm text-muted-foreground">Loading inaugural auction room...</p> : null}

          {!auctionState && !isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Button onClick={() => setOrderMethod("ALPHABETICAL")} type="button" variant={orderMethod === "ALPHABETICAL" ? "default" : "outline"}>
                  Alphabetical
                </Button>
                <Button onClick={() => setOrderMethod("DIVISION")} type="button" variant={orderMethod === "DIVISION" ? "default" : "outline"}>
                  Division Order
                </Button>
                <Button onClick={() => setOrderMethod("PREVIOUS_YEAR_RECORD")} type="button" variant={orderMethod === "PREVIOUS_YEAR_RECORD" ? "default" : "outline"}>
                  Previous-Year Record
                </Button>
              </div>

              {orderMethod === "DIVISION" ? (
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Choose the division nomination order. Teams inside each division stay alphabetical.</p>
                  {divisionOrder.map((division, index) => (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm" key={division}>
                      <span>{division}</span>
                      <div className="flex gap-2">
                        <Button disabled={index === 0} onClick={() => moveDivision(index, -1)} type="button" variant="ghost">
                          Up
                        </Button>
                        <Button disabled={index === divisionOrder.length - 1} onClick={() => moveDivision(index, 1)} type="button" variant="ghost">
                          Down
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : orderMethod === "PREVIOUS_YEAR_RECORD" ? (
                <p className="text-sm text-muted-foreground">
                  If prior-year NFL regular-season results are incomplete, this mode safely falls back to alphabetical nomination order.
                </p>
              ) : null}

              <Button disabled={isSubmitting} onClick={() => void handleConfigureAuction()} type="button">
                Save Inaugural Auction Order
              </Button>
            </div>
          ) : null}

          {auctionState ? (
            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {auctionState.currentNomination ? "Team On The Clock" : auctionState.auction.status === "COMPLETED" ? "Auction Complete" : "Auction Setup"}
                    </CardTitle>
                    <CardDescription>
                      {auctionState.auction.status === "PLANNING"
                        ? "Review the nomination order, then start the inaugural auction."
                        : auctionState.auction.status === "COMPLETED"
                        ? "All 30 awarded teams have been finalized into season ownership."
                        : "Any eligible owner can bid while the clock is live."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {auctionState.currentNomination ? (
                      <div className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Current team</p>
                            <div className="mt-1 text-base font-medium">
                              <NFLTeamLabel size="detail" team={auctionState.currentNomination.nflTeam} />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Time remaining</p>
                            <p className="text-2xl font-semibold">{auctionState.countdown?.secondsRemaining ?? 0}s</p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                            <div className="text-muted-foreground">Current high bid</div>
                            <div className="font-medium">
                              {auctionState.currentHighBid
                                ? `${formatCurrency(auctionState.currentHighBid.amount)} by ${auctionState.currentHighBid.displayName}`
                                : "No bids yet"}
                            </div>
                          </div>
                          <div className="rounded-lg border border-border bg-background px-4 py-3 text-sm">
                            <div className="text-muted-foreground">Auction progress</div>
                            <div className="font-medium">
                              {auctionState.auction.awardedCount} / 30 teams awarded
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {auctionState.auction.status === "PLANNING" && auctionState.viewer.canManageAuction ? (
                      <Button disabled={isSubmitting} onClick={() => void handleStartAuction()} type="button">
                        Start Inaugural Auction
                      </Button>
                    ) : null}

                    {auctionState.viewer.canBid && auctionState.currentNomination ? (
                      <div className="space-y-3 rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground">
                          Your remaining budget: {formatCurrency(viewer?.budgetRemaining ?? 0)}. Team count: {viewer?.teamCount ?? 0} / 3.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <input
                            className="h-10 w-40 rounded-md border border-input bg-background px-3 text-sm"
                            min={minimumNextBid}
                            onChange={(event) => setBidAmount(event.target.value)}
                            type="number"
                            value={bidAmount}
                          />
                          <Button disabled={isSubmitting || Number(bidAmount) < minimumNextBid || Number(bidAmount) > (viewer?.maxAllowedBid ?? 0)} onClick={() => void handleSubmitBid()} type="button">
                            Submit Bid
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Minimum next bid: {formatCurrency(minimumNextBid)}. Your max valid bid: {formatCurrency(viewer?.maxAllowedBid ?? 0)}.
                        </p>
                      </div>
                    ) : viewer && auctionState.auction.status === "ACTIVE" ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        {viewer.teamCount === 3
                          ? "You already have 3 awarded teams and are now view-only for the rest of the auction."
                          : "You can watch this live auction room, but you are not eligible to bid at the moment."}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Recent bids</p>
                      {auctionState.recentBids.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Bids will appear here as owners raise the price.
                        </div>
                      ) : (
                        auctionState.recentBids.map((bid) => (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm" key={bid.id}>
                            <div className="flex items-center gap-3">
                              <ProfileAvatar className="h-8 w-8 border-border bg-slate-100 text-slate-700" imageUrl={bid.profileImageUrl} name={bid.displayName} />
                              <span>{bid.displayName}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(bid.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Nomination Order</CardTitle>
                    <CardDescription>Teams advance automatically through the saved inaugural auction order.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {auctionState.nominations.map((nomination) => (
                      <div className="rounded-lg border border-border px-4 py-3 text-sm" key={nomination.id}>
                        <div className="font-medium">
                          #{nomination.orderIndex + 1} <NFLTeamLabel size="compact" team={nomination.nflTeam} />
                        </div>
                        <div className="text-muted-foreground">
                          {nomination.isAwarded
                            ? "Awarded"
                            : auctionState.currentNomination?.id === nomination.id
                            ? "On the clock"
                            : "Upcoming"}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Owner Budgets</CardTitle>
                  <CardDescription>Each owner starts with $100 and must finish with exactly 3 teams.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {auctionState.owners.map((owner) => (
                    <div className="rounded-lg border border-border px-4 py-3 text-sm" key={owner.leagueMemberId}>
                      <div className="flex items-center gap-3">
                        <ProfileAvatar className="h-9 w-9 border-border bg-slate-100 text-slate-700" imageUrl={owner.profileImageUrl} name={owner.displayName} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{owner.displayName}</div>
                          <div className="text-muted-foreground">
                            {owner.teamCount} / 3 teams | {formatCurrency(owner.budgetRemaining)} left
                          </div>
                        </div>
                      </div>
                      {owner.awardedTeams.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {owner.awardedTeams.map((team) => (
                            <span className="rounded-full border border-border px-3 py-1 text-xs" key={`${owner.leagueMemberId}-${team.id}`}>
                              <NFLTeamLabel size="compact" team={team} />
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {auctionState?.activeAward && visibleAwardId === auctionState.activeAward.id ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Team Awarded</p>
            <h3 className="mt-3 text-2xl font-semibold text-foreground">{auctionState.activeAward.displayName}</h3>
            <div className="mt-4 text-base">
              <NFLTeamLabel size="detail" team={auctionState.activeAward.nflTeam} />
            </div>
            <p className="mt-3 text-lg font-medium text-foreground">{formatCurrency(auctionState.activeAward.amount)}</p>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setVisibleAwardId(null)} type="button" variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {auctionState?.finalSummary && showFinalSummary ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-border bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-semibold text-foreground">Inaugural Auction Complete</h3>
            <p className="mt-2 text-sm text-muted-foreground">Thirty teams were awarded and authoritative season ownership has been written into the league.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-4 text-sm">
                <div className="font-medium">Biggest spender</div>
                <div className="text-muted-foreground">
                  {auctionState.finalSummary.biggestSpender
                    ? `${auctionState.finalSummary.biggestSpender.displayName} (${formatCurrency(auctionState.finalSummary.biggestSpender.amount)})`
                    : "Not available"}
                </div>
              </div>
              <div className="rounded-lg border border-border p-4 text-sm">
                <div className="font-medium">Lowest spender</div>
                <div className="text-muted-foreground">
                  {auctionState.finalSummary.lowestSpender
                    ? `${auctionState.finalSummary.lowestSpender.displayName} (${formatCurrency(auctionState.finalSummary.lowestSpender.amount)})`
                    : "Not available"}
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {auctionState.finalSummary.owners.map((owner) => (
                <div className="rounded-lg border border-border p-4 text-sm" key={owner.leagueMemberId}>
                  <div className="font-medium">{owner.displayName}</div>
                  <div className="text-muted-foreground">
                    Spent {formatCurrency(owner.budgetSpent)} | Left {formatCurrency(owner.budgetRemaining)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {owner.teams.map((team) => (
                      <span className="rounded-full border border-border px-3 py-1 text-xs" key={`${owner.leagueMemberId}-${team.id}`}>
                        <NFLTeamLabel size="compact" team={team} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => {
                  setShowFinalSummary(false);
                  router.push("/");
                }}
                type="button"
              >
                Return Home
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
