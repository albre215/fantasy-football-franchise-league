import Image from "next/image";
import Link from "next/link";

import { BrandAccountSlot } from "@/components/brand/brand-account-slot";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
          <section className="relative overflow-hidden rounded-[2rem] border border-[#123222] bg-[radial-gradient(circle_at_top_left,rgba(113,255,104,0.22),transparent_28%),linear-gradient(135deg,#081a11_0%,#0d2919_52%,#143222_100%)] shadow-[0_30px_90px_-42px_rgba(1,24,14,0.92)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,204,92,0.06),transparent)] opacity-80" />
            <div className="relative min-h-[320px] sm:min-h-[460px]">
              <BrandAccountSlot />
              <div className="absolute left-5 top-5 z-20 sm:left-6 sm:top-6">
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "border-white/65 bg-white/10 text-white hover:bg-white/18 hover:text-white"
                  )}
                  href="/"
                >
                  Back to Home
                </Link>
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
                <div className="relative h-full w-full max-w-none">
                  <Image
                    alt="GM Fantasy logo"
                    className="h-full w-full scale-[1.18] object-contain drop-shadow-[0_18px_38px_rgba(0,0,0,0.28)]"
                    fill
                    priority
                    sizes="100vw"
                    src="/brand/gm-fantasy-logo.png"
                  />
                </div>
              </div>
            </div>
          </section>

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
