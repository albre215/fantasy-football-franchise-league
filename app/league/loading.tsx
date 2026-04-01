import Link from "next/link";

import { BrandMasthead } from "@/components/brand/brand-masthead";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        {Array.from({ length: lines }).map((_, index) => (
          <div className="h-5 animate-pulse rounded-md bg-secondary/30" key={index} />
        ))}
      </CardContent>
    </Card>
  );
}

export default function LeagueLoading() {
  return (
    <main className="min-h-screen py-10 sm:py-12">
      <div className="container flex min-h-screen flex-col justify-start py-4">
        <div className="space-y-8">
          <BrandMasthead
            actions={
              <Link className={buttonVariants({ variant: "outline" })} href="/">
                Back to Home
              </Link>
            }
            description="Loading league workspace..."
            eyebrow="Commissioner Console"
            title="League Bootstrap Console"
          />

          <Card className="brand-surface">
            <CardHeader>
              <CardTitle>Opening League</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-secondary/25" />
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <LoadingBlock lines={4} />
                <LoadingBlock lines={4} />
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                <LoadingBlock lines={5} />
                <LoadingBlock lines={5} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
