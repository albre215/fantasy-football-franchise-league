"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AccountProfile, AccountProfileResponse } from "@/types/account";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function AccountSettingsForm({ account }: { account: AccountProfile }) {
  const { update } = useSession();
  const [displayName, setDisplayName] = useState(account.displayName);
  const [phoneNumber, setPhoneNumber] = useState(account.phoneNumber ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const hasChanges = displayName.trim() !== account.displayName || phoneNumber.trim() !== (account.phoneNumber ?? "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName,
          phoneNumber
        })
      });

      const data = await parseJsonResponse<AccountProfileResponse>(response);

      setDisplayName(data.account.displayName);
      setPhoneNumber(data.account.phoneNumber ?? "");
      setSuccessMessage("Account settings updated.");
      await update({
        user: {
          displayName: data.account.displayName
        }
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update account settings.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>Review and update the account details currently stored for your profile.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-display-name">
              Display name
            </label>
            <Input
              id="account-display-name"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-email">
              Email
            </label>
            <Input id="account-email" readOnly value={account.email} />
            <p className="text-sm text-muted-foreground">Email is currently read-only in this account flow.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="account-phone">
              Phone number
            </label>
            <Input
              id="account-phone"
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Optional phone number"
              type="tel"
              value={phoneNumber}
            />
          </div>
          <CardFooter className="px-0 pb-0 pt-2">
            <Button disabled={isSubmitting || !hasChanges || !displayName.trim()} type="submit">
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </CardContent>
      {(errorMessage || successMessage) ? (
        <CardFooter className="pt-0 text-sm text-muted-foreground">
          <p className={errorMessage ? "text-red-600" : "text-emerald-700"}>{errorMessage ?? successMessage}</p>
        </CardFooter>
      ) : null}
    </Card>
  );
}
