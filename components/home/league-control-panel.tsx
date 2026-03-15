"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  CreateLeagueResponse,
  JoinLeagueResponse,
  LeagueListItem,
  ListLeaguesResponse
} from "@/types/league";

const DEFAULT_USER_ID = "mock-user-1";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueControlPanel() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [joinLeagueId, setJoinLeagueId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sortedLeagues = useMemo(
    () => [...leagues].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [leagues]
  );

  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const response = await fetch("/api/league/list", {
          cache: "no-store"
        });
        const data = await parseJsonResponse<ListLeaguesResponse>(response);

        if (isActive) {
          setLeagues(data.leagues);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load leagues.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleCreateLeague(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/league/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          name: leagueName
        })
      });
      const data = await parseJsonResponse<CreateLeagueResponse>(response);

      setLeagueName("");
      setSuccessMessage(`Created ${data.league.name}.`);
      setLeagues((current) => [
        {
          id: data.league.id,
          name: data.league.name,
          slug: data.league.slug,
          description: data.league.description,
          createdAt: data.league.createdAt,
          memberCount: data.league.members.length,
          seasonCount: data.league.seasons.length
        },
        ...current.filter((league) => league.id !== data.league.id)
      ]);

      router.push(`/league?leagueId=${data.league.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create league.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleJoinLeague(leagueId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/league/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          leagueId
        })
      });
      const data = await parseJsonResponse<JoinLeagueResponse>(response);

      setSuccessMessage(`Joined ${data.league.name}.`);
      setLeagues((current) => {
        const nextLeagues = current.map((league) =>
          league.id === data.league.id
            ? {
                ...league,
                memberCount: data.league.members.length
              }
            : league
        );

        if (nextLeagues.some((league) => league.id === data.league.id)) {
          return nextLeagues;
        }

        return [
          {
            id: data.league.id,
            name: data.league.name,
            slug: data.league.slug,
            description: data.league.description,
            createdAt: data.league.createdAt,
            memberCount: data.league.members.length,
            seasonCount: data.league.seasons.length
          },
          ...nextLeagues
        ];
      });

      router.push(`/league?leagueId=${data.league.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to join league.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleJoinById(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!joinLeagueId.trim()) {
      setErrorMessage("League ID is required.");
      return;
    }

    await handleJoinLeague(joinLeagueId.trim());
    setJoinLeagueId("");
  }

  return (
    <section className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle>Create League</CardTitle>
            <CardDescription>Bootstrap a new league and assign the mock user as commissioner.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateLeague}>
              <Input
                onChange={(event) => setLeagueName(event.target.value)}
                placeholder="League name"
                value={leagueName}
              />
              <Button disabled={isSubmitting || !leagueName.trim()} type="submit">
                Create League
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle>Join League</CardTitle>
            <CardDescription>Use a league ID to attach the mock user as an owner.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleJoinById}>
              <Input
                onChange={(event) => setJoinLeagueId(event.target.value)}
                placeholder="League ID"
                value={joinLeagueId}
              />
              <Button disabled={isSubmitting || !joinLeagueId.trim()} type="submit" variant="secondary">
                Join by ID
              </Button>
            </form>
          </CardContent>
        </Card>
        {(errorMessage || successMessage) && (
          <Card className={cn("border-border/70", errorMessage ? "bg-red-50" : "bg-emerald-50")}>
            <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
          </Card>
        )}
      </div>
      <Card className="border-border/70 bg-card/90">
        <CardHeader>
          <CardTitle>Leagues</CardTitle>
          <CardDescription>Active league records available through the new domain API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Loading leagues...
            </div>
          ) : sortedLeagues.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No leagues exist yet.
            </div>
          ) : (
            sortedLeagues.map((league) => (
              <Card key={league.id} className="border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">{league.name}</CardTitle>
                  <CardDescription>{league.description ?? "No description provided yet."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>League ID: {league.id}</p>
                  <p>Members: {league.memberCount} / 10</p>
                  <p>Seasons: {league.seasonCount}</p>
                </CardContent>
                <CardFooter className="gap-3">
                  <Link className={buttonVariants({ variant: "outline" })} href={`/league?leagueId=${league.id}`}>
                    View Dashboard
                  </Link>
                  <Button
                    disabled={isSubmitting}
                    onClick={() => void handleJoinLeague(league.id)}
                    type="button"
                    variant="secondary"
                  >
                    Join League
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
