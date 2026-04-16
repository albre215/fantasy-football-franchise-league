"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ConfigureInauguralAuctionResponse,
  InauguralAuctionOrderMethod,
  InauguralAuctionOrderPreview,
  InauguralAuctionPreviousYearSortDirection,
  InauguralAuctionOrderPreviewResponse,
  InauguralAuctionState,
  InauguralAuctionStateResponse,
  StartInauguralAuctionResponse,
  SubmitInauguralBidResponse
} from "@/types/inaugural-auction";
import type { SeasonSummary } from "@/types/season";
import type { NFLTeamsResponse, NFLTeamSummary } from "@/types/team-ownership";

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

function buildPreviewFromTeams(
  teams: NFLTeamSummary[],
  orderMethod: InauguralAuctionOrderMethod,
  divisionOrder: string[],
  customOrder: string[]
) {
  const sortedAlphabetical = [...teams].sort((left, right) => left.name.localeCompare(right.name));

  if (orderMethod === "ALPHABETICAL") {
    return {
      orderMethod,
      notes: [],
      divisionOrder: null,
      entries: sortedAlphabetical.map((team, index) => ({
        orderIndex: index,
        nflTeam: team,
        note: null
      }))
    } satisfies InauguralAuctionOrderPreview;
  }

  if (orderMethod === "DIVISION") {
    const byDivision = new Map<string, NFLTeamSummary[]>();

    for (const team of teams) {
      const key = `${team.conference} ${team.division}`;
      const bucket = byDivision.get(key) ?? [];
      bucket.push(team);
      byDivision.set(key, [...bucket].sort((left, right) => left.name.localeCompare(right.name)));
    }

    return {
      orderMethod,
      notes: [],
      divisionOrder,
      entries: divisionOrder
        .flatMap((division) => [...(byDivision.get(division) ?? [])].sort((left, right) => left.name.localeCompare(right.name)))
        .map((team, index) => ({
          orderIndex: index,
          nflTeam: team,
          note: `${team.conference} ${team.division}`
        }))
    } satisfies InauguralAuctionOrderPreview;
  }

  if (orderMethod === "CUSTOM") {
    const teamById = new Map(teams.map((team) => [team.id, team] as const));

    return {
      orderMethod,
      notes: [],
      divisionOrder: null,
      entries: customOrder
        .map((teamId) => teamById.get(teamId))
        .filter((team): team is NFLTeamSummary => Boolean(team))
        .map((team, index) => ({
          orderIndex: index,
          nflTeam: team,
          note: `${team.conference} ${team.division}`
        }))
    } satisfies InauguralAuctionOrderPreview;
  }

  return {
    orderMethod,
    notes: ["Loading previous-year record order preview..."],
    divisionOrder: null,
    entries: []
  } satisfies InauguralAuctionOrderPreview;
}

export function InauguralAuctionPanel({
  activeSeason,
  title = "Inaugural Auction Draft",
  description = ""
}: InauguralAuctionPanelProps) {
  const router = useRouter();
  const [auctionState, setAuctionState] = useState<InauguralAuctionState | null>(null);
  const [teams, setTeams] = useState<NFLTeamSummary[]>([]);
  const [preview, setPreview] = useState<InauguralAuctionOrderPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [orderMethod, setOrderMethod] = useState<InauguralAuctionOrderMethod>("ALPHABETICAL");
  const [previousYearSortDirection, setPreviousYearSortDirection] =
    useState<InauguralAuctionPreviousYearSortDirection>("BEST_FIRST");
  const [divisionOrder, setDivisionOrder] = useState<string[]>(DEFAULT_DIVISION_ORDER);
  const [customTeamOrder, setCustomTeamOrder] = useState<string[]>([]);
  const [draggedDivision, setDraggedDivision] = useState<string | null>(null);
  const [divisionInsertIndex, setDivisionInsertIndex] = useState<number | null>(null);
  const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null);
  const [customDropIndex, setCustomDropIndex] = useState<number | null>(null);
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

  async function refreshPreview(
    nextOrderMethod: InauguralAuctionOrderMethod,
    nextDivisionOrder: string[],
    nextCustomTeamOrder: string[],
    nextPreviousYearSortDirection: InauguralAuctionPreviousYearSortDirection
  ) {
    if (!activeSeason) {
      return;
    }

    if (nextOrderMethod === "CUSTOM" && nextCustomTeamOrder.length !== teams.length) {
      setPreview(buildPreviewFromTeams(teams, nextOrderMethod, nextDivisionOrder, nextCustomTeamOrder));
      return;
    }

    if (nextOrderMethod !== "PREVIOUS_YEAR_RECORD" && teams.length > 0) {
      setPreview(buildPreviewFromTeams(teams, nextOrderMethod, nextDivisionOrder, nextCustomTeamOrder));
    }

    try {
      setIsLoadingPreview(true);
      const response = await fetch(`/api/season/${activeSeason.id}/inaugural-auction/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderMethod: nextOrderMethod,
          divisionOrder: nextOrderMethod === "DIVISION" ? nextDivisionOrder : undefined,
          customTeamOrder: nextOrderMethod === "CUSTOM" ? nextCustomTeamOrder : undefined,
          previousYearSortDirection:
            nextOrderMethod === "PREVIOUS_YEAR_RECORD" ? nextPreviousYearSortDirection : undefined
        })
      });
      const data = await parseJsonResponse<InauguralAuctionOrderPreviewResponse>(response);
      setPreview(data.preview);
    } catch (error) {
      if (nextOrderMethod === "PREVIOUS_YEAR_RECORD") {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the inaugural auction preview.");
      }
    } finally {
      setIsLoadingPreview(false);
    }
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
    void (async () => {
      try {
        setIsLoadingTeams(true);
        const response = await fetch("/api/nfl/teams", { cache: "no-store" });
        const data = await parseJsonResponse<NFLTeamsResponse>(response);
        setTeams(data.teams);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load NFL teams.");
      } finally {
        setIsLoadingTeams(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!auctionState) {
      return;
    }

    if (auctionState.auction.status === "PLANNING") {
      setOrderMethod(auctionState.auction.orderMethod);
      setDivisionOrder(auctionState.orderPreview.divisionOrder ?? DEFAULT_DIVISION_ORDER);
      if (auctionState.auction.orderMethod === "CUSTOM") {
        setCustomTeamOrder(auctionState.orderPreview.entries.map((entry) => entry.nflTeam.id));
      }
      setPreview(auctionState.orderPreview);
    }

    if (auctionState.activeAward?.id) {
      setVisibleAwardId(auctionState.activeAward.id);
    }
  }, [auctionState]);

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

  useEffect(() => {
    if (!activeSeason || teams.length === 0) {
      return;
    }

    if (auctionState && auctionState.auction.status !== "PLANNING") {
      return;
    }

    void refreshPreview(orderMethod, divisionOrder, customTeamOrder, previousYearSortDirection);
  }, [activeSeason?.id, teams.length, orderMethod, divisionOrder, customTeamOrder, previousYearSortDirection, auctionState?.auction.status]);

  const viewer = auctionState?.viewer ?? null;
  const canConfigureAuction = !auctionState || auctionState.auction.status === "PLANNING";
  const minimumNextBid = useMemo(() => {
    if (!auctionState?.currentHighBid) {
      return 1;
    }

    return auctionState.currentHighBid.amount + 1;
  }, [auctionState?.currentHighBid?.amount]);
  const previewToRender = canConfigureAuction ? preview : auctionState?.orderPreview ?? null;
  const teamsByDivision = useMemo(() => {
    const grouped = new Map<string, NFLTeamSummary[]>();

    for (const team of teams) {
      const key = `${team.conference} ${team.division}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(team);
      grouped.set(key, [...bucket].sort((left, right) => left.name.localeCompare(right.name)));
    }

    return grouped;
  }, [teams]);
  const availableCustomTeams = useMemo(
    () => teams.filter((team) => !customTeamOrder.includes(team.id)).sort((left, right) => left.name.localeCompare(right.name)),
    [teams, customTeamOrder]
  );

  function getSubmittingButtonClass(actionId: string) {
    if (!isSubmitting) {
      return undefined;
    }

    return pendingActionId === actionId ? "disabled:opacity-70" : "disabled:opacity-100";
  }

  async function handleConfigureAuction() {
    if (!activeSeason) {
      return;
    }

    try {
      setIsSubmitting(true);
      setPendingActionId("configure-auction");
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await fetch(`/api/season/${activeSeason.id}/inaugural-auction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderMethod,
          divisionOrder: orderMethod === "DIVISION" ? divisionOrder : undefined,
          customTeamOrder: orderMethod === "CUSTOM" ? customTeamOrder : undefined,
          previousYearSortDirection:
            orderMethod === "PREVIOUS_YEAR_RECORD" ? previousYearSortDirection : undefined
        })
      });
      const data = await parseJsonResponse<ConfigureInauguralAuctionResponse>(response);
      setAuctionState(data.auction);
      setSuccessMessage("Inaugural auction order saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to configure the inaugural auction.");
    } finally {
      setPendingActionId(null);
      setIsSubmitting(false);
    }
  }

  async function handleStartAuction() {
    if (!activeSeason) {
      return;
    }

    try {
      setIsSubmitting(true);
      setPendingActionId("start-auction");
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
      setPendingActionId(null);
      setIsSubmitting(false);
    }
  }

  async function handleSubmitBid(nominationId?: string) {
    if (!activeSeason) {
      return;
    }

    try {
      setIsSubmitting(true);
      setPendingActionId(nominationId ? `select-${nominationId}` : "submit-bid");
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await fetch(`/api/season/${activeSeason.id}/inaugural-auction/bid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: nominationId ? 1 : Number(bidAmount),
          nominationId
        })
      });
      const data = await parseJsonResponse<SubmitInauguralBidResponse>(response);
      setAuctionState(data.auction);
      setSuccessMessage(nominationId ? "Final team selected." : "Bid submitted.");
      setBidAmount(String(Math.max(minimumNextBid + 1, 1)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit the bid.");
    } finally {
      setPendingActionId(null);
      setIsSubmitting(false);
    }
  }

  function createDivisionDragPreview(element: HTMLDivElement) {
    const clone = element.cloneNode(true) as HTMLDivElement;
    clone.style.position = "fixed";
    clone.style.top = "-1000px";
    clone.style.left = "-1000px";
    clone.style.width = `${element.offsetWidth}px`;
    clone.style.pointerEvents = "none";
    clone.style.opacity = "1";
    clone.style.transform = "rotate(0deg)";
    clone.style.boxShadow = "0 18px 40px -24px rgba(7, 28, 18, 0.45)";
    clone.style.borderColor = "rgb(52 211 153)";
    clone.style.background = "rgb(240 253 244)";
    document.body.appendChild(clone);
    window.setTimeout(() => {
      clone.remove();
    }, 0);

    return clone;
  }

  function handleDivisionDrop(targetIndex: number) {
    if (!draggedDivision) {
      setDivisionInsertIndex(null);
      return;
    }

    setDivisionOrder((current) => {
      const next = [...current];
      const fromIndex = next.indexOf(draggedDivision);
      if (fromIndex < 0) {
        return current;
      }

      const [moved] = next.splice(fromIndex, 1);
      const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
      next.splice(insertIndex, 0, moved);
      return next;
    });
    setDivisionInsertIndex(null);
    setDraggedDivision(null);
  }

  function handleCustomTeamDrop(targetIndex?: number) {
    if (!draggedTeamId) {
      return;
    }

    setCustomTeamOrder((current) => {
      const withoutDragged = current.filter((teamId) => teamId !== draggedTeamId);
      const insertIndex = typeof targetIndex === "number" ? Math.min(targetIndex, withoutDragged.length) : withoutDragged.length;
      withoutDragged.splice(insertIndex, 0, draggedTeamId);
      return withoutDragged;
    });
    setCustomDropIndex(null);
    setDraggedTeamId(null);
  }

  function removeCustomTeam(teamId: string) {
    setCustomTeamOrder((current) => current.filter((entry) => entry !== teamId));
  }

  if (!activeSeason) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-5">
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
          {isLoading ? <p className="text-sm text-muted-foreground">Loading inaugural auction room...</p> : null}

          {canConfigureAuction ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { value: "ALPHABETICAL", label: "Alphabetical" },
                  { value: "DIVISION", label: "Division Order" },
                  { value: "PREVIOUS_YEAR_RECORD", label: "Previous-Year Record" },
                  { value: "CUSTOM", label: "Custom Order" }
                ].map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => setOrderMethod(option.value as InauguralAuctionOrderMethod)}
                    type="button"
                    variant={orderMethod === option.value ? "default" : "outline"}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>

              {orderMethod === "DIVISION" ? (
                <div className="space-y-3 rounded-2xl border border-border p-4">
                  <div>
                    <p className="font-medium text-foreground">Auction Order Preview</p>
                    <p className="text-sm text-muted-foreground">
                      Drag divisions into a new nomination order. Teams on each row stay alphabetical inside the division.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {divisionOrder.map((division, index) => (
                      <div className="space-y-2" key={division}>
                        <div
                          className={cn(
                            "h-3 rounded-full border-2 border-dashed border-transparent transition",
                            draggedDivision
                              ? divisionInsertIndex === index
                                ? "border-emerald-400 bg-emerald-100"
                                : "hover:border-emerald-200 hover:bg-emerald-50"
                              : ""
                          )}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggedDivision) {
                              setDivisionInsertIndex(index);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleDivisionDrop(index);
                          }}
                        />
                        <div
                          className={cn(
                            "rounded-2xl border border-border bg-background px-4 py-4 transition",
                            draggedDivision === division
                              ? "border-emerald-400 bg-emerald-50 shadow-[0_18px_40px_-24px_rgba(7,28,18,0.45)]"
                              : "hover:border-emerald-200 hover:bg-emerald-50/40"
                          )}
                          draggable
                          onDragEnd={() => {
                            setDraggedDivision(null);
                            setDivisionInsertIndex(null);
                          }}
                          onDragStart={(event) => {
                            setDraggedDivision(division);
                            setDivisionInsertIndex(index);
                            event.dataTransfer.effectAllowed = "move";
                            const previewElement = createDivisionDragPreview(event.currentTarget as HTMLDivElement);
                            event.dataTransfer.setDragImage(previewElement, 32, 24);
                          }}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-8 text-lg font-semibold text-emerald-700">{index + 1}.</div>
                            <div>
                              <p className="font-medium text-foreground">{division}</p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                {(teamsByDivision.get(division) ?? []).map((team) => (
                                  <NFLTeamLabel
                                    className="rounded-full border border-border/70 bg-background px-2 py-1"
                                    key={team.id}
                                    size="compact"
                                    team={team}
                                    textClassName="text-xs"
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div
                      className={cn(
                        "h-3 rounded-full border-2 border-dashed border-transparent transition",
                        draggedDivision
                          ? divisionInsertIndex === divisionOrder.length
                            ? "border-emerald-400 bg-emerald-100"
                            : "hover:border-emerald-200 hover:bg-emerald-50"
                          : ""
                      )}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (draggedDivision) {
                          setDivisionInsertIndex(divisionOrder.length);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDivisionDrop(divisionOrder.length);
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {orderMethod === "CUSTOM" ? (
                <div className="space-y-4 rounded-2xl border border-border p-4">
                  <div>
                    <p className="font-medium text-foreground">Auction Order Preview</p>
                    <p className="text-sm text-muted-foreground">
                      Drag teams into the Auction Order Preview below and rearrange as needed to determine auction order.
                    </p>
                  </div>
                  <div
                    className="space-y-4 rounded-2xl border border-border bg-background/70 p-3"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleCustomTeamDrop();
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">Available Teams</p>
                      <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-dashed border-border bg-background/70 p-3">
                        {isLoadingTeams ? (
                          <p className="text-sm text-muted-foreground">Loading NFL teams...</p>
                        ) : availableCustomTeams.length === 0 ? (
                          <p className="text-sm text-muted-foreground">All 32 teams are currently in the auction order.</p>
                        ) : (
                          availableCustomTeams.map((team) => (
                            <button
                              className="rounded-full border border-border bg-white px-3 py-2 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
                              draggable
                              key={team.id}
                              onDragStart={() => setDraggedTeamId(team.id)}
                              type="button"
                            >
                              <NFLTeamLabel size="compact" team={team} textClassName="text-xs" />
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Auction Order Preview</p>
                      {customTeamOrder.length === 0 ? (
                        <div
                          className={cn(
                            "rounded-2xl border border-dashed p-6 text-sm text-muted-foreground transition",
                            draggedTeamId ? "border-emerald-400 bg-emerald-50" : "border-border"
                          )}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setCustomDropIndex(0);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleCustomTeamDrop(0);
                          }}
                        >
                          Drop the first team here to create line 1.
                        </div>
                      ) : (
                        <>
                          {customTeamOrder.map((teamId, index) => {
                            const team = teams.find((entry) => entry.id === teamId);

                            if (!team) {
                              return null;
                            }

                            return (
                              <div className="space-y-2" key={team.id}>
                                <div
                                  className={cn(
                                    "h-3 rounded-full border-2 border-dashed border-transparent transition",
                                    draggedTeamId
                                      ? customDropIndex === index
                                        ? "border-emerald-400 bg-emerald-100"
                                        : "hover:border-emerald-200 hover:bg-emerald-50"
                                      : ""
                                  )}
                                  onDragOver={(event) => {
                                    event.preventDefault();
                                    if (draggedTeamId) {
                                      setCustomDropIndex(index);
                                    }
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    handleCustomTeamDrop(index);
                                  }}
                                />
                                <div
                                  className={cn(
                                    "rounded-2xl border border-border bg-white px-4 py-3 transition",
                                    draggedTeamId === team.id
                                      ? "border-emerald-400 bg-emerald-50 shadow-[0_18px_40px_-24px_rgba(7,28,18,0.45)]"
                                      : "hover:border-emerald-200"
                                  )}
                                  draggable
                                  onDragEnd={() => {
                                    setDraggedTeamId(null);
                                    setCustomDropIndex(null);
                                  }}
                                  onDragStart={() => setDraggedTeamId(team.id)}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-4">
                                      <div className="w-8 text-lg font-semibold text-emerald-700">{index + 1}.</div>
                                      <NFLTeamLabel size="default" team={team} />
                                    </div>
                                    <Button onClick={() => removeCustomTeam(team.id)} type="button" variant="ghost">
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div
                            className={cn(
                              "h-3 rounded-full border-2 border-dashed border-transparent transition",
                              draggedTeamId
                                ? customDropIndex === customTeamOrder.length
                                  ? "border-emerald-400 bg-emerald-100"
                                  : "hover:border-emerald-200 hover:bg-emerald-50"
                                : ""
                            )}
                            onDragOver={(event) => {
                              event.preventDefault();
                              if (draggedTeamId) {
                                setCustomDropIndex(customTeamOrder.length);
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleCustomTeamDrop(customTeamOrder.length);
                            }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {previewToRender && orderMethod !== "CUSTOM" ? (
                <div className="space-y-3 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Auction Order Preview</p>
                      <p className="text-sm text-muted-foreground">
                        {orderMethod === "PREVIOUS_YEAR_RECORD"
                          ? "Review the full 1-32 prior-year record order. Matching records break alphabetically."
                          : orderMethod === "ALPHABETICAL"
                            ? "Previewing the full 1-32 alphabetical nomination order."
                            : orderMethod === "DIVISION"
                              ? "Previewing the full 1-32 order based on the selected division sequence."
                              : "Previewing the custom 1-32 order you are building."}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {orderMethod === "PREVIOUS_YEAR_RECORD" ? (
                        <Button
                          onClick={() =>
                            setPreviousYearSortDirection((current) =>
                              current === "BEST_FIRST" ? "WORST_FIRST" : "BEST_FIRST"
                            )
                          }
                          type="button"
                          variant="outline"
                        >
                          {previousYearSortDirection === "BEST_FIRST"
                            ? "Record Order: Best -> Worst"
                            : "Record Order: Worst -> Best"}
                        </Button>
                      ) : null}
                      {isLoadingPreview ? <span className="text-sm text-muted-foreground">Refreshing preview...</span> : null}
                    </div>
                  </div>

                  {previewToRender.notes.length > 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                      {previewToRender.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    {previewToRender.entries.map((entry) => (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3" key={`${entry.orderIndex}-${entry.nflTeam.id}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-8 text-sm font-semibold text-emerald-700">{entry.orderIndex + 1}.</div>
                          <NFLTeamLabel size="default" team={entry.nflTeam} />
                        </div>
                        {entry.note ? <div className="text-sm text-muted-foreground">{entry.note}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                className={getSubmittingButtonClass("configure-auction")}
                disabled={isSubmitting || (orderMethod === "CUSTOM" && customTeamOrder.length !== 32)}
                onClick={() => void handleConfigureAuction()}
                type="button"
              >
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
                      {auctionState.finalSelection
                        ? "Final Team Selection"
                        : auctionState.currentNomination
                          ? "Team On The Clock"
                          : auctionState.auction.status === "COMPLETED"
                            ? "Auction Complete"
                            : "Auction Setup"}
                    </CardTitle>
                    <CardDescription>
                      {auctionState.finalSelection
                        ? "One owner has one team left to claim. Choose from the final three remaining teams at an automatic $1."
                        : auctionState.auction.status === "PLANNING"
                          ? "Review the nomination order, then start the inaugural auction."
                          : auctionState.auction.status === "COMPLETED"
                            ? "All 30 awarded teams have been finalized into season ownership."
                            : "Any eligible owner can bid while the clock is live."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {auctionState.finalSelection ? (
                      <div className="space-y-4 rounded-2xl border border-border p-4">
                        <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">{auctionState.finalSelection.displayName}</span> is selecting the final
                            team. No bidding is needed in this last step.
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          {auctionState.finalSelection.availableTeams.map((entry) => (
                            <div className="rounded-2xl border border-border bg-background p-4" key={entry.nominationId}>
                              <NFLTeamLabel size="default" team={entry.team} />
                              <p className="mt-3 text-sm text-muted-foreground">
                                Automatic award amount: {formatCurrency(auctionState.finalSelection?.automaticBidAmount ?? 1)}
                              </p>
                              {viewer?.canSelectFinalTeam ? (
                                <Button
                                  className={cn("mt-4 w-full", getSubmittingButtonClass(`select-${entry.nominationId}`))}
                                  disabled={isSubmitting}
                                  onClick={() => void handleSubmitBid(entry.nominationId)}
                                  type="button"
                                >
                                  Select Team
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

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
                            <div className="font-medium">{auctionState.auction.awardedCount} / 30 teams awarded</div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {auctionState.auction.status === "PLANNING" && auctionState.viewer.canManageAuction ? (
                      <Button className={getSubmittingButtonClass("start-auction")} disabled={isSubmitting} onClick={() => void handleStartAuction()} type="button">
                        Start Inaugural Auction
                      </Button>
                    ) : null}

                    {auctionState.viewer.canBid && auctionState.currentNomination ? (
                      <div className="space-y-3 rounded-lg border border-border p-4">
                        <p className="text-sm text-muted-foreground">
                          Your remaining budget: {formatCurrency(viewer?.budgetRemaining ?? 0)}. Team count: {viewer?.teamCount ?? 0} / 3.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <input className="h-10 w-40 rounded-md border border-input bg-background px-3 text-sm" min={minimumNextBid} onChange={(event) => setBidAmount(event.target.value)} type="number" value={bidAmount} />
                          <Button className={getSubmittingButtonClass("submit-bid")} disabled={isSubmitting || Number(bidAmount) < minimumNextBid || Number(bidAmount) > (viewer?.maxAllowedBid ?? 0)} onClick={() => void handleSubmitBid()} type="button">
                            Submit Bid
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Minimum next bid: {formatCurrency(minimumNextBid)}. Your max valid bid: {formatCurrency(viewer?.maxAllowedBid ?? 0)}.
                        </p>
                      </div>
                    ) : viewer && auctionState.auction.status === "ACTIVE" && !auctionState.finalSelection ? (
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
                  <CardContent className="grid gap-2">
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
                              : auctionState.finalSelection?.availableTeams.some((entry) => entry.nominationId === nomination.id)
                                ? "Final selection pool"
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
            <p className="mt-2 text-sm text-muted-foreground">
              Thirty teams were awarded and authoritative season ownership has been written into the league.
            </p>
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
