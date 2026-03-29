"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
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

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueControlPanel() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leagues, setLeagues] = useState<LeagueListItem[]>([]);
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

  const sortedLeagues = useMemo(
    () => [...leagues].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [leagues]
  );
  const registerDisplayNameValue = registerDisplayName.trim();
  const registerPasswordsMatch = registerPassword === registerConfirmPassword;
  const registerPasswordMismatch =
    registerPassword.length > 0 && registerConfirmPassword.length > 0 && !registerPasswordsMatch;

  useEffect(() => {
    if (hasManuallyEditedDisplayName) {
      return;
    }

    const derivedDisplayName = [registerFirstName.trim(), registerLastName.trim()].filter(Boolean).join(" ");
    setRegisterDisplayName(derivedDisplayName);
  }, [hasManuallyEditedDisplayName, registerFirstName, registerLastName]);

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

  async function handleSignOut() {
    setErrorMessage(null);
    setSuccessMessage(null);
    await signOut({
      callbackUrl: "/"
    });
  }

  const isAuthenticated = status === "authenticated" && Boolean(session?.user?.id);

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
          ? "mt-14 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
          : "mt-10 w-full max-w-xl"
      }
    >
      <div className="space-y-6">
        {status === "loading" ? (
          <Card className="border-border/70 bg-card/90">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading authentication state...</CardContent>
          </Card>
        ) : !isAuthenticated ? (
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
        ) : (
          <>
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Signed In</CardTitle>
                <CardDescription>Commissioner and owner actions now run under your authenticated account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{session.user.displayName}</p>
                <p>{session.user.email}</p>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-3">
                <Link className={buttonVariants({ variant: "secondary" })} href="/me">
                  My Dashboard
                </Link>
                <Button onClick={() => void handleSignOut()} type="button" variant="outline">
                  Sign Out
                </Button>
              </CardFooter>
            </Card>
            <Card className="border-border/70 bg-card/90">
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
                  <Button disabled={isSubmitting || !leagueName.trim()} type="submit">
                    Create League
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Join League</CardTitle>
                <CardDescription>Use a league ID to join an existing league with your authenticated user.</CardDescription>
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
          </>
        )}
        {(errorMessage || successMessage) && (
          <Card className={cn("border-border/70", errorMessage ? "bg-red-50" : "bg-emerald-50")}>
            <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
          </Card>
        )}
      </div>
      {isAuthenticated ? (
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle>Leagues</CardTitle>
            <CardDescription>League records currently available in the system.</CardDescription>
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
      ) : null}
    </section>
  );
}
