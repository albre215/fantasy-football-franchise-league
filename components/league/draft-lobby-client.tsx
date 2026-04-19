"use client";

import { Card, CardContent } from "@/components/ui/card";
import { InauguralAuctionPanel } from "@/components/league/inaugural-auction-panel";
import type { SeasonSummary } from "@/types/season";

interface DraftLobbyClientProps {
  activeSeason: SeasonSummary | null;
  errorMessage: string | null;
  leagueName: string;
}

export function DraftLobbyClient({ activeSeason, errorMessage, leagueName }: DraftLobbyClientProps) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <div className="container space-y-6 py-8">
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {leagueName} — Draft Lobby
          </p>
          <h1 className="text-2xl font-semibold text-emerald-950">Inaugural Auction Draft Lobby</h1>
        </header>

        {errorMessage ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-800">{errorMessage}</CardContent>
          </Card>
        ) : null}

        {activeSeason?.draftMode === "INAUGURAL_AUCTION" ? (
          <InauguralAuctionPanel activeSeason={activeSeason} />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No inaugural auction is available for this league right now.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
