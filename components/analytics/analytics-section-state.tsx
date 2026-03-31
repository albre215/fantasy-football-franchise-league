"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AnalyticsSectionSkeleton({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 animate-pulse rounded-md bg-secondary/80" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded-md bg-secondary/60" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="brand-surface">
          <CardContent className="space-y-4 p-6">
            <div className="h-6 w-48 animate-pulse rounded-md bg-secondary/80" />
            <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-secondary/60" />
            <div className="h-72 rounded-xl border border-dashed border-border bg-background/70" />
          </CardContent>
        </Card>
        <Card className="brand-surface">
          <CardContent className="space-y-4 p-6">
            <div className="h-6 w-40 animate-pulse rounded-md bg-secondary/80" />
            <div className="h-4 w-full max-w-sm animate-pulse rounded-md bg-secondary/60" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="rounded-lg border border-border bg-background px-4 py-4" key={index}>
                  <div className="h-5 w-40 animate-pulse rounded-md bg-secondary/70" />
                  <div className="mt-3 h-4 w-48 animate-pulse rounded-md bg-secondary/60" />
                  <div className="mt-2 h-4 w-36 animate-pulse rounded-md bg-secondary/50" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="brand-surface">
        <CardContent className="space-y-3 p-6">
          <div className="h-6 w-52 animate-pulse rounded-md bg-secondary/80" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded-md bg-secondary/60" />
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="rounded-lg border border-border p-4" key={index}>
                <div className="h-5 w-44 animate-pulse rounded-md bg-secondary/70" />
                <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded-md bg-secondary/60" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="brand-surface">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Loading {title.toLowerCase()}...
          <span className="block pt-2">{description}</span>
        </CardContent>
      </Card>
    </section>
  );
}

export function AnalyticsSectionError({
  message,
  onRetry
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="brand-surface border-destructive/30">
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Analytics are unavailable right now.</div>
          <div className="text-sm text-muted-foreground">{message}</div>
        </div>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
