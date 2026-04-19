"use client";

import { BrandLogo } from "@/components/brand/brand-logo";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function validateToken() {
      if (!token) {
        setIsValidating(false);
        setIsTokenValid(false);
        setErrorMessage("This password reset link is invalid or has expired.");
        return;
      }

      try {
        setIsValidating(true);
        setErrorMessage(null);
        const response = await fetch(`/api/auth/recovery/password/validate?token=${encodeURIComponent(token)}`, {
          cache: "no-store"
        });
        const data = await parseJsonResponse<{ valid: true; email: string }>(response);

        if (isActive) {
          setEmail(data.email);
          setIsTokenValid(true);
        }
      } catch (error) {
        if (isActive) {
          setIsTokenValid(false);
          setErrorMessage(error instanceof Error ? error.message : "Unable to validate reset link.");
        }
      } finally {
        if (isActive) {
          setIsValidating(false);
        }
      }
    }

    void validateToken();

    return () => {
      isActive = false;
    };
  }, [token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords must match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await parseJsonResponse<{ success: true }>(
        await fetch("/api/auth/recovery/password/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token,
            password,
            confirmPassword
          })
        })
      );

      setSuccessMessage("Password updated. Redirecting you back to sign in...");
      window.setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen py-10 sm:py-12">
      <div className="container flex min-h-screen flex-col justify-center py-6">
        <div className="space-y-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-[#123222] bg-[radial-gradient(circle_at_top_left,rgba(113,255,104,0.22),transparent_28%),linear-gradient(135deg,#081a11_0%,#0d2919_52%,#143222_100%)] shadow-[0_30px_90px_-42px_rgba(1,24,14,0.92)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,204,92,0.06),transparent)] opacity-80" />
            <div className="relative min-h-[260px] sm:min-h-[360px]">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
                <BrandLogo size="hero" priority />
              </div>
            </div>
          </section>
          <Card className="mx-auto w-full max-w-xl border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>{email ? `Create a new password for ${email}.` : "Create a new password for your account."}</CardDescription>
            </CardHeader>
            <CardContent>
              {isValidating ? (
                <p className="text-sm text-muted-foreground">Validating your reset link...</p>
              ) : isTokenValid ? (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="reset-password">
                      New password
                    </label>
                    <Input
                      id="reset-password"
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      value={password}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="reset-password-confirm">
                      Confirm new password
                    </label>
                    <Input
                      id="reset-password-confirm"
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type="password"
                      value={confirmPassword}
                    />
                  </div>
                  <Button disabled={isSubmitting || !password || !confirmPassword} type="submit">
                    Save
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-red-600">{errorMessage ?? "This password reset link is invalid or has expired."}</p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-3 border-t border-border/60 pt-5">
              {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
              {!isValidating && isTokenValid && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
              <Link className="text-sm font-medium text-foreground underline-offset-4 hover:underline" href="/">
                Back to sign in
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}
