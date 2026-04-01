"use client";

import Link from "next/link";
import { Crown, Info } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CreateLeagueResponse, JoinLeagueResponse, LeagueListItem } from "@/types/league";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

interface LeagueControlPanelProps {
  initialIsAuthenticated: boolean;
  initialLeagues: LeagueListItem[];
}

export function LeagueControlPanel({ initialIsAuthenticated, initialLeagues }: LeagueControlPanelProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leagues, setLeagues] = useState<LeagueListItem[]>(initialLeagues);
  const [leagueName, setLeagueName] = useState("");
  const [joinLeagueId, setJoinLeagueId] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhoneNumber, setRegisterPhoneNumber] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"sign-in" | "register">("sign-in");
  const [hasManuallyEditedDisplayName, setHasManuallyEditedDisplayName] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openingLeagueId, setOpeningLeagueId] = useState<string | null>(null);

  const sortedLeagues = useMemo(
    () => [...leagues].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [leagues]
  );
  const registerDisplayNameValue = registerDisplayName.trim();
  const registerPasswordsMatch = registerPassword === registerConfirmPassword;
  const registerPasswordMismatch =
    registerPassword.length > 0 && registerConfirmPassword.length > 0 && !registerPasswordsMatch;
  const isAuthenticated = initialIsAuthenticated || (status === "authenticated" && Boolean(session?.user?.id));
  const showAuthLoading = !initialIsAuthenticated && status === "loading";

  useEffect(() => {
    if (hasManuallyEditedDisplayName) {
      return;
    }

    const derivedDisplayName = [registerFirstName.trim(), registerLastName.trim()].filter(Boolean).join(" ");
    setRegisterDisplayName(derivedDisplayName);
  }, [hasManuallyEditedDisplayName, registerFirstName, registerLastName]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLeagues([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setLeagues(initialLeagues);
    setIsLoading(false);
  }, [initialLeagues]);

  useEffect(() => {
    if (!isAuthenticated || initialLeagues.length === 0) {
      return;
    }

    for (const league of initialLeagues) {
      router.prefetch(`/league?leagueId=${league.id}`);
    }
  }, [initialLeagues, isAuthenticated, router]);

  function handleOpenLeague(leagueId: string) {
    setOpeningLeagueId(leagueId);
    startTransition(() => {
      router.push(`/league?leagueId=${leagueId}`);
    });
  }

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
          name: leagueName
        })
      });
      const data = await parseJsonResponse<CreateLeagueResponse>(response);

      setLeagueName("");
      setSuccessMessage(`Created ${data.league.name}.`);
      setLeagues((current) => [
        {
          id: data.league.id,
          leagueCode: data.league.leagueCode,
          name: data.league.name,
          slug: data.league.slug,
          description: data.league.description,
          createdAt: data.league.createdAt,
          memberCount: data.league.members.length,
          seasonCount: data.league.seasons.length,
          currentUserRole: "COMMISSIONER"
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
          leagueCode: leagueId
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
            leagueCode: data.league.leagueCode,
            name: data.league.name,
            slug: data.league.slug,
            description: data.league.description,
            createdAt: data.league.createdAt,
            memberCount: data.league.members.length,
            seasonCount: data.league.seasons.length,
            currentUserRole: "OWNER"
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
      setErrorMessage("League code is required.");
      return;
    }

    await handleJoinLeague(joinLeagueId.trim());
    setJoinLeagueId("");
  }

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (registerPasswordMismatch) {
      setErrorMessage("Confirm password must match password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: registerDisplayNameValue,
          email: registerEmail,
          phoneNumber: registerPhoneNumber,
          password: registerPassword
        })
      });

      await parseJsonResponse<{ user: { id: string } }>(response);
      const signInResult = await signIn("credentials", {
        email: registerEmail,
        password: registerPassword,
        redirect: false
      });

      if (signInResult?.error) {
        throw new Error(signInResult.error);
      }

      setRegisterDisplayName("");
      setRegisterFirstName("");
      setRegisterLastName("");
      setRegisterEmail("");
      setRegisterPhoneNumber("");
      setRegisterPassword("");
      setRegisterConfirmPassword("");
      setHasManuallyEditedDisplayName(false);
      setAuthMode("sign-in");
      setSuccessMessage("Account created and signed in.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to register account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false
      });

      if (result?.error) {
        throw new Error("Invalid email or password.");
      }

      setLoginEmail("");
      setLoginPassword("");
      setSuccessMessage("Signed in.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function AuthFieldLabel({
    htmlFor,
    label,
    tooltip
  }: {
    htmlFor: string;
    label: string;
    tooltip?: string;
  }) {
    return (
      <label className="flex items-center gap-1.5 text-sm font-medium text-foreground" htmlFor={htmlFor}>
        <span>{label}</span>
        {tooltip ? (
          <span className="inline-flex items-center text-muted-foreground" title={tooltip}>
            <Info className="h-4 w-4" />
            <span className="sr-only">{tooltip}</span>
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <section
      className={
        isAuthenticated
          ? "mt-14 space-y-6"
          : "mt-10 w-full max-w-xl"
      }
    >
      {showAuthLoading ? (
        <div className="space-y-6">
          <Card className="brand-surface">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading authentication state...</CardContent>
          </Card>
        </div>
      ) : !isAuthenticated ? (
        <div className="space-y-6">
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle>{authMode === "sign-in" ? "Sign In" : "Create Account"}</CardTitle>
              <CardDescription>
                {authMode === "sign-in"
                  ? "Use your email and password to access your league workspace."
                  : "Create an account for league access. If a commissioner already added your email, registration will claim that existing user record."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {authMode === "sign-in" ? (
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <AuthFieldLabel htmlFor="login-email" label="Email" />
                    <Input
                      id="login-email"
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      value={loginEmail}
                    />
                  </div>
                  <div className="space-y-2">
                    <AuthFieldLabel htmlFor="login-password" label="Password" />
                    <Input
                      id="login-password"
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Password"
                      type="password"
                      value={loginPassword}
                    />
                  </div>
                  <Button disabled={isSubmitting || !loginEmail.trim() || !loginPassword} type="submit">
                    Sign In
                  </Button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={handleRegister}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <AuthFieldLabel htmlFor="register-first-name" label="First name" />
                      <Input
                        id="register-first-name"
                        onChange={(event) => setRegisterFirstName(event.target.value)}
                        placeholder="First name"
                        value={registerFirstName}
                      />
                    </div>
                    <div className="space-y-2">
                      <AuthFieldLabel htmlFor="register-last-name" label="Last name" />
                      <Input
                        id="register-last-name"
                        onChange={(event) => setRegisterLastName(event.target.value)}
                        placeholder="Last name"
                        value={registerLastName}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <AuthFieldLabel htmlFor="register-display-name" label="Display name" />
                    <Input
                      id="register-display-name"
                      onChange={(event) => {
                        setHasManuallyEditedDisplayName(true);
                        setRegisterDisplayName(event.target.value);
                      }}
                      placeholder="Display name shown in league views"
                      value={registerDisplayName}
                    />
                  </div>
                  <div className="space-y-2">
                    <AuthFieldLabel
                      htmlFor="register-email"
                      label="Email"
                      tooltip="This email is used for sign-in, verification, and password recovery."
                    />
                    <Input
                      id="register-email"
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      value={registerEmail}
                    />
                  </div>
                  <div className="space-y-2">
                    <AuthFieldLabel
                      htmlFor="register-phone-number"
                      label="Phone number"
                      tooltip="This phone number can be used for two-factor verification and password recovery."
                    />
                    <Input
                      id="register-phone-number"
                      onChange={(event) => setRegisterPhoneNumber(event.target.value)}
                      placeholder="Optional phone number"
                      type="tel"
                      value={registerPhoneNumber}
                    />
                  </div>
                  <div className="space-y-2">
                    <AuthFieldLabel htmlFor="register-password" label="Password" />
                    <Input
                      id="register-password"
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      placeholder="Password"
                      type="password"
                      value={registerPassword}
                    />
                  </div>
                  <div className="space-y-2">
                    <AuthFieldLabel htmlFor="register-confirm-password" label="Confirm password" />
                    <Input
                      id="register-confirm-password"
                      onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                      placeholder="Confirm password"
                      type="password"
                      value={registerConfirmPassword}
                    />
                    {registerPasswordMismatch ? (
                      <p className="text-sm text-red-600">Confirm password must match password.</p>
                    ) : null}
                  </div>
                  <Button
                    disabled={
                      isSubmitting ||
                      !registerFirstName.trim() ||
                      !registerLastName.trim() ||
                      !registerDisplayNameValue ||
                      !registerEmail.trim() ||
                      !registerPassword ||
                      !registerConfirmPassword ||
                      registerPasswordMismatch
                    }
                    type="submit"
                    variant="secondary"
                  >
                    Create Account
                  </Button>
                </form>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-3 border-t border-border/60 pt-5">
              {authMode === "sign-in" ? (
                <>
                  <button
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setAuthMode("register");
                    }}
                    type="button"
                  >
                    Create an account
                  </button>
                  <p className="text-sm text-muted-foreground">
                    New to the league? Create an account and then sign in with it here.
                  </p>
                </>
              ) : (
                <>
                  <button
                    className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setAuthMode("sign-in");
                    }}
                    type="button"
                  >
                    Already have an account? Sign in
                  </button>
                  <p className="text-sm text-muted-foreground">
                    Return to sign in with an existing account.
                  </p>
                </>
              )}
            </CardFooter>
          </Card>
          {(errorMessage || successMessage) ? (
            <Card className={cn("brand-surface", errorMessage ? "bg-red-50" : "bg-emerald-50")}>
              <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="brand-surface">
            <CardHeader className="space-y-2">
              <CardTitle>My Leagues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Loading your leagues...
                </div>
              ) : sortedLeagues.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  You are not a member of any leagues yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedLeagues.map((league) => (
                    <Card key={league.id} className="brand-muted-panel shadow-none">
                      <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex min-h-10 flex-wrap items-center gap-2">
                            <CardTitle className="text-xl">{league.name}</CardTitle>
                            {league.currentUserRole === "COMMISSIONER" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                                <Crown className="h-3.5 w-3.5" />
                                Commissioner
                              </span>
                            ) : null}
                          </div>
                          {league.description ? <CardDescription>{league.description}</CardDescription> : null}
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                            <p>Members: {league.memberCount} / 10</p>
                            <p>Seasons: {league.seasonCount}</p>
                            <p className="truncate">League Code: {league.leagueCode ?? league.id}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center self-stretch sm:self-auto">
                          <Button
                            disabled={openingLeagueId !== null}
                            onClick={() => handleOpenLeague(league.id)}
                            type="button"
                          >
                            {openingLeagueId === league.id ? "Opening League..." : "Open League"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>Create League</CardTitle>
                <CardDescription>Create a league and make your authenticated user the commissioner.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleCreateLeague}>
                  <Input
                    onChange={(event) => setLeagueName(event.target.value)}
                    placeholder="League name"
                    value={leagueName}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button disabled={isSubmitting || !leagueName.trim()} type="submit">
                      Create League
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            <Card className="brand-surface">
              <CardHeader>
                <CardTitle>Join League</CardTitle>
                <CardDescription>Use a league code to join an existing league with your authenticated user.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleJoinById}>
                  <Input
                    onChange={(event) => setJoinLeagueId(event.target.value)}
                    placeholder="League code (for example, GMF-1)"
                    value={joinLeagueId}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button disabled={isSubmitting || !joinLeagueId.trim()} type="submit" variant="secondary">
                      Join League
                    </Button>
                    <Link className={buttonVariants({ variant: "outline" })} href="/league">
                      Open League Hub
                    </Link>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
          <Card className="brand-surface">
            <CardHeader>
              <CardTitle className="text-base">Owner Links</CardTitle>
              <CardDescription>Lower-priority shortcuts for owner-specific pages.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link className={buttonVariants({ variant: "outline" })} href="/dashboard">
                Owner Workflows
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/me">
                My Owner Dashboard
              </Link>
            </CardContent>
          </Card>
          {(errorMessage || successMessage) ? (
            <Card className={cn("brand-surface", errorMessage ? "bg-red-50" : "bg-emerald-50")}>
              <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  );
}
