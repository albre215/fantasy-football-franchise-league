"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CreateManualAdjustmentResponse } from "@/types/ledger";
import type { LeagueBootstrapMember } from "@/types/league";
import type { SeasonSummary } from "@/types/season";

interface CommissionerAdjustmentCardProps {
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

export function CommissionerAdjustmentCard({
  activeSeason,
  canManageLedger,
  accessMessage,
  members,
  onError,
  onSuccess
}: CommissionerAdjustmentCardProps) {
  const [adjustmentMemberId, setAdjustmentMemberId] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentDescription, setAdjustmentDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownerOptions = useMemo(
    () =>
      members.map((member) => ({
        leagueMemberId: member.id,
        displayName: member.displayName
      })),
    [members]
  );

  async function handleCreateAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSeason) {
      return;
    }
    onError(null);
    onSuccess(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/season/${activeSeason.id}/ledger/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueMemberId: adjustmentMemberId,
          amount: Number(adjustmentAmount),
          description: adjustmentDescription
        })
      });
      const data = await parseJsonResponse<CreateManualAdjustmentResponse>(response);
      setAdjustmentAmount("");
      setAdjustmentDescription("");
      onSuccess(`Recorded ${formatCurrency(data.createdEntry.amount)} for ${data.createdEntry.owner.displayName}.`);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to create the manual adjustment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commissioner Adjustment</CardTitle>
        <CardDescription>
          Add a manual positive or negative adjustment. These entries are persisted immediately in the ledger.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeSeason ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Create or activate a season first to record adjustments.
          </div>
        ) : !canManageLedger && accessMessage ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {accessMessage}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleCreateAdjustment}>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setAdjustmentMemberId(event.target.value)}
              value={adjustmentMemberId}
            >
              <option value="">Select owner</option>
              {ownerOptions.map((owner) => (
                <option key={owner.leagueMemberId} value={owner.leagueMemberId}>
                  {owner.displayName}
                </option>
              ))}
            </select>
            <Input
              onChange={(event) => setAdjustmentAmount(event.target.value)}
              placeholder="Amount (for example 25.00 or -10.00)"
              step="0.01"
              type="number"
              value={adjustmentAmount}
            />
            <Input
              onChange={(event) => setAdjustmentDescription(event.target.value)}
              placeholder="Reason / description"
              value={adjustmentDescription}
            />
            <Button
              disabled={isSubmitting || !adjustmentMemberId || !adjustmentAmount || !adjustmentDescription}
              type="submit"
            >
              Record Adjustment
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
