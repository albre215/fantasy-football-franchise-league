"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { Crown, Info } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  CreateLeagueResponse,
  JoinLeagueResponse,
  JoinLeagueSuggestion,
  JoinLeagueSuggestionsResponse,
  LeagueListItem
} from "@/types/league";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 3) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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
  const [joinSuggestions, setJoinSuggestions] = useState<JoinLeagueSuggestion[]>([]);
  const [isLoadingJoinSuggestions, setIsLoadingJoinSuggestions] = useState(false);
  const [selectedJoinSuggestionCode, setSelectedJoinSuggestionCode] = useState<string | null>(null);
  const [registerFirstName, setRegisterFirstName] = useState("");
  const [registerLastName, setRegisterLastName] = useState("");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhoneNumber, setRegisterPhoneNumber] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"sign-in" | "register">("sign-in");
  const [leagueActionMode, setLeagueActionMode] = useState<"join" | "create">("join");
  const [hasManuallyEditedDisplayName, setHasManuallyEditedDisplayName] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState<"choose" | "password-reset" | "temporary-login" | "verify-code">(
    "choose"
  );
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPhoneNumber, setRecoveryPhoneNumber] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryChallengeId, setRecoveryChallengeId] = useState<string | null>(null);
  const [recoveryPreviewResetUrl, setRecoveryPreviewResetUrl] = useState<string | null>(null);
  const [recoveryPreviewCode, setRecoveryPreviewCode] = useState<string | null>(null);
  const [recoveryMaskedPhoneNumber, setRecoveryMaskedPhoneNumber] = useState<string | null>(null);
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false);
  const [recoveryErrorMessage, setRecoveryErrorMessage] = useState<string | null>(null);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState<string | null>(null);
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
    setIsClient(true);
  }, []);

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
    if (!isAuthenticated || leagueActionMode !== "join") {
      setJoinSuggestions([]);
      setIsLoadingJoinSuggestions(false);
      return;
    }

    const query = joinLeagueId.trim();

    if (!query) {
      setJoinSuggestions([]);
      setIsLoadingJoinSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setIsLoadingJoinSuggestions(true);
        const response = await fetch(`/api/league/join/suggestions?query=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const data = await parseJsonResponse<JoinLeagueSuggestionsResponse>(response);
        setJoinSuggestions(data.suggestions);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setJoinSuggestions([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingJoinSuggestions(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isAuthenticated, joinLeagueId, leagueActionMode]);

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

  function resetRecoveryMessages() {
    setRecoveryErrorMessage(null);
    setRecoverySuccessMessage(null);
  }

  function openRecoveryModal() {
    setRecoveryMode("choose");
    setRecoveryEmail(loginEmail.trim());
    setRecoveryPhoneNumber("");
    setRecoveryCode("");
    setRecoveryChallengeId(null);
    setRecoveryPreviewResetUrl(null);
    setRecoveryPreviewCode(null);
    setRecoveryMaskedPhoneNumber(null);
    resetRecoveryMessages();
    setIsRecoveryModalOpen(true);
  }

  function closeRecoveryModal() {
    setIsRecoveryModalOpen(false);
    setRecoveryMode("choose");
    setRecoveryPhoneNumber("");
    setRecoveryCode("");
    setRecoveryChallengeId(null);
    setRecoveryPreviewResetUrl(null);
    setRecoveryPreviewCode(null);
    setRecoveryMaskedPhoneNumber(null);
    resetRecoveryMessages();
  }

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
    setJoinSuggestions([]);
    setSelectedJoinSuggestionCode(null);
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
      setShowLoginPassword(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordRecoveryRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetRecoveryMessages();
    setRecoveryPreviewResetUrl(null);
    setIsRecoverySubmitting(true);

    try {
      const response = await fetch("/api/auth/recovery/password/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: recoveryEmail
        })
      });

      const data = await parseJsonResponse<{
        message: string;
        delivery: {
          channel: "email" | "preview";
          previewResetUrl?: string;
        };
      }>(response);

      setRecoverySuccessMessage(
        data.delivery.channel === "preview"
          ? "No email provider is configured yet, so a local preview reset link is shown below."
          : "A password reset email has been sent to the email on file."
      );
      setRecoveryPreviewResetUrl(data.delivery.previewResetUrl ?? null);
    } catch (error) {
      setRecoveryErrorMessage(error instanceof Error ? error.message : "Unable to send password reset email.");
    } finally {
      setIsRecoverySubmitting(false);
    }
  }

  async function requestTemporaryLoginCode() {
    resetRecoveryMessages();
    setRecoveryPreviewCode(null);
    setIsRecoverySubmitting(true);

    try {
      const response = await fetch("/api/auth/recovery/temporary-login/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phoneNumber: recoveryPhoneNumber
        })
      });

      const data = await parseJsonResponse<{
        challengeId: string;
        delivery: {
          channel: "sms" | "preview";
          maskedPhoneNumber: string;
          previewCode?: string;
        };
      }>(response);

      setRecoveryChallengeId(data.challengeId);
      setRecoveryMaskedPhoneNumber(data.delivery.maskedPhoneNumber);
      setRecoveryPreviewCode(data.delivery.previewCode ?? null);
      setRecoveryMode("verify-code");
      setRecoverySuccessMessage(
        data.delivery.channel === "preview"
          ? `No SMS provider is configured yet, so a local preview code is shown below for ${data.delivery.maskedPhoneNumber}.`
          : `A 6-digit login code was sent to ${data.delivery.maskedPhoneNumber}.`
      );
    } catch (error) {
      setRecoveryErrorMessage(error instanceof Error ? error.message : "Unable to send a temporary login code.");
    } finally {
      setIsRecoverySubmitting(false);
    }
  }

  async function handleTemporaryLoginRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestTemporaryLoginCode();
  }

  async function handleTemporaryCodeVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetRecoveryMessages();
    setIsRecoverySubmitting(true);

    try {
      const result = await signIn("recovery-code", {
        challengeId: recoveryChallengeId,
        code: recoveryCode,
        redirect: false
      });

      if (result?.error) {
        throw new Error("Code is incorrect. Try again.");
      }

      setRecoverySuccessMessage("Temporary login approved. Signing you in...");
      closeRecoveryModal();
      setRecoveryCode("");
      router.refresh();
    } catch (error) {
      setRecoveryErrorMessage(error instanceof Error ? error.message : "Unable to verify the temporary login code.");
    } finally {
      setIsRecoverySubmitting(false);
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
                    <div className="relative">
                      <Input
                        className="pr-11"
                        id="login-password"
                        onChange={(event) => setLoginPassword(event.target.value)}
                        placeholder="Password"
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                      />
                      <button
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setShowLoginPassword((current) => !current)}
                        type="button"
                      >
                        {showLoginPassword ? (
                          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <path d="M3 3L21 21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                            <path
                              d="M10.58 10.58A2 2 0 0013.42 13.42M9.88 5.09A10.94 10.94 0 0112 4.91c5.05 0 8.27 3.11 9.53 5.09a1.95 1.95 0 010 2c-.55.87-1.44 2.04-2.72 3.08M6.53 6.53C4.7 7.8 3.49 9.43 2.47 11a1.95 1.95 0 000 2C3.73 14.98 6.95 18.09 12 18.09c1.78 0 3.36-.39 4.75-1"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.8"
                            />
                          </svg>
                        ) : (
                          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <path
                              d="M2.46 12C3.73 9.98 6.95 6.91 12 6.91S20.27 9.98 21.54 12C20.27 14.02 17.05 17.09 12 17.09S3.73 14.02 2.46 12Z"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.8"
                            />
                            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <Button disabled={isSubmitting || !loginEmail.trim() || !loginPassword} type="submit">
                    Sign In
                  </Button>
                  <div>
                    <button
                      className="text-sm font-semibold text-[#1846d1] underline underline-offset-2 transition-colors hover:text-[#0f348f]"
                      onClick={openRecoveryModal}
                      type="button"
                    >
                      Forgot Password
                    </button>
                  </div>
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
          <Card className="brand-surface">
            <CardHeader>
              <CardTitle>{leagueActionMode === "join" ? "Join League" : "Create League"}</CardTitle>
            </CardHeader>
            <CardContent>
              {leagueActionMode === "join" ? (
                <form className="space-y-4" onSubmit={handleJoinById}>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        className="flex-1"
                        onChange={(event) => {
                          setJoinLeagueId(event.target.value);
                          setSelectedJoinSuggestionCode(null);
                        }}
                        placeholder="League code (for example, GMF-1)"
                        value={joinLeagueId}
                      />
                      <Button
                        className="sm:mr-6 sm:shrink-0"
                        disabled={isSubmitting || !joinLeagueId.trim()}
                        type="submit"
                        variant="secondary"
                      >
                        Join League
                      </Button>
                    </div>
                    {isLoadingJoinSuggestions ? (
                      <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                        Searching league codes...
                      </div>
                    ) : joinSuggestions.length > 0 ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-background">
                        {joinSuggestions.map((suggestion) => (
                          <button
                            className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-3 text-left transition hover:bg-secondary/40 last:border-b-0"
                            key={suggestion.id}
                            onClick={() => {
                              setJoinLeagueId(suggestion.leagueCode);
                              setJoinSuggestions([]);
                              setSelectedJoinSuggestionCode(suggestion.leagueCode);
                            }}
                            type="button"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{suggestion.leagueCode}</p>
                            </div>
                            <div className="shrink-0 text-right text-xs text-muted-foreground">
                              <p>{suggestion.memberCount}/10 members</p>
                              <p>{suggestion.seasonCount} seasons</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : joinLeagueId.trim() && selectedJoinSuggestionCode !== joinLeagueId.trim() ? (
                      <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                        No matching league codes found.
                      </div>
                    ) : null}
                  </div>
                </form>
              ) : (
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
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-3 border-t border-border/60 pt-5">
              {leagueActionMode === "join" ? (
                <>
                  <button
                    className="text-sm font-semibold text-blue-800 underline underline-offset-4 transition hover:text-blue-900"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setSelectedJoinSuggestionCode(null);
                      setLeagueActionMode("create");
                    }}
                    type="button"
                  >
                    Create a league
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="text-sm font-semibold text-blue-800 underline underline-offset-4 transition hover:text-blue-900"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setSelectedJoinSuggestionCode(null);
                      setLeagueActionMode("join");
                    }}
                    type="button"
                  >
                    Join an existing league
                  </button>
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
      )}
      {isClient && isRecoveryModalOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
              <div className="w-full max-w-lg rounded-[1.75rem] border border-border bg-white p-6 shadow-[0_30px_80px_-28px_rgba(7,28,18,0.45)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-foreground">
                      {recoveryMode === "temporary-login" || recoveryMode === "verify-code"
                        ? "Login with Phone Verification"
                        : "Account Recovery"}
                    </h2>
                    {recoveryMode === "choose" ? (
                      <p className="text-sm text-muted-foreground">
                        Choose whether to reset your password by email or temporarily log in with a verification code.
                      </p>
                    ) : null}
                  </div>
                  <button
                    aria-label="Close account recovery dialog"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    onClick={closeRecoveryModal}
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                    </svg>
                  </button>
                </div>
                <div className="mt-5 space-y-4">
                  {recoveryMode === "choose" ? (
                    <div className="space-y-3">
                      <button
                        className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-left transition hover:bg-secondary"
                        onClick={() => {
                          resetRecoveryMessages();
                          setRecoveryMode("password-reset");
                        }}
                        type="button"
                      >
                        <span className="block text-base font-semibold text-foreground">Reset password by email</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Enter the email on file and we will send a reset link if the account exists.
                        </span>
                      </button>
                      <button
                        className="w-full rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-left transition hover:bg-secondary"
                        onClick={() => {
                          resetRecoveryMessages();
                          setRecoveryMode("temporary-login");
                        }}
                        type="button"
                      >
                        <span className="block text-base font-semibold text-foreground">Temporarily login with phone verification</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          Enter the email on file and we will send a 6-digit code to the phone number on that account.
                        </span>
                      </button>
                    </div>
                  ) : null}

                  {recoveryMode === "password-reset" ? (
                    <form className="space-y-4" onSubmit={handlePasswordRecoveryRequest}>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="recovery-email-reset">
                          Email on file
                        </label>
                        <Input
                          id="recovery-email-reset"
                          onChange={(event) => setRecoveryEmail(event.target.value)}
                          placeholder="you@example.com"
                          type="email"
                          value={recoveryEmail}
                        />
                      </div>
                      {recoveryPreviewResetUrl ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <p className="font-medium">Local preview link</p>
                          <a className="mt-1 block break-all underline" href={recoveryPreviewResetUrl}>
                            {recoveryPreviewResetUrl}
                          </a>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <Button disabled={isRecoverySubmitting || !recoveryEmail.trim()} type="submit">
                          Submit
                        </Button>
                        <Button
                          onClick={() => {
                            resetRecoveryMessages();
                            setRecoveryPreviewResetUrl(null);
                            setRecoveryMode("choose");
                          }}
                          type="button"
                          variant="outline"
                        >
                          Back
                        </Button>
                      </div>
                    </form>
                  ) : null}

                  {recoveryMode === "temporary-login" ? (
                    <form className="space-y-4" onSubmit={handleTemporaryLoginRequest}>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="recovery-phone-number">
                          Phone number on file
                        </label>
                        <Input
                          id="recovery-phone-number"
                          onChange={(event) => setRecoveryPhoneNumber(formatPhoneNumber(event.target.value))}
                          placeholder="Ex: (555) 123-4567"
                          type="tel"
                          value={recoveryPhoneNumber}
                        />
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button disabled={isRecoverySubmitting || !recoveryPhoneNumber.trim()} type="submit">
                          Send 6-Digit Code
                        </Button>
                        <Button
                          onClick={() => {
                            resetRecoveryMessages();
                            setRecoveryMode("choose");
                          }}
                          type="button"
                          variant="outline"
                        >
                          Back
                        </Button>
                      </div>
                    </form>
                  ) : null}

                  {recoveryMode === "verify-code" ? (
                    <form className="space-y-4" onSubmit={handleTemporaryCodeVerification}>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Enter the 6-digit code sent to {recoveryMaskedPhoneNumber ?? "the phone number on file"}.
                        </p>
                        <label className="text-sm font-medium text-foreground" htmlFor="recovery-code">
                          Verification code
                        </label>
                        <Input
                          id="recovery-code"
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(event) => setRecoveryCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="123456"
                          value={recoveryCode}
                        />
                      </div>
                      {recoveryPreviewCode ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          <p className="font-medium">Local preview code</p>
                          <p className="mt-1 text-lg font-semibold tracking-[0.28em]">{recoveryPreviewCode}</p>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <Button disabled={isRecoverySubmitting || recoveryCode.length !== 6 || !recoveryChallengeId} type="submit">
                          Submit
                        </Button>
                        <button
                          className="text-sm font-semibold text-[#1846d1] underline underline-offset-2 transition-colors hover:text-[#0f348f]"
                          onClick={() => void requestTemporaryLoginCode()}
                          type="button"
                        >
                          Resend 6-digit code
                        </button>
                        <button
                          className="text-sm font-semibold text-[#1846d1] underline underline-offset-2 transition-colors hover:text-[#0f348f]"
                          onClick={() => {
                            resetRecoveryMessages();
                            setRecoveryPreviewResetUrl(null);
                            setRecoveryMode("password-reset");
                          }}
                          type="button"
                        >
                          Reset password via email
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {recoveryErrorMessage ? <p className="text-sm text-red-600">{recoveryErrorMessage}</p> : null}
                  {recoverySuccessMessage ? <p className="text-sm text-emerald-700">{recoverySuccessMessage}</p> : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
