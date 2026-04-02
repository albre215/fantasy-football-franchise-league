import Image from "next/image";

import { getServerAuthSession } from "@/auth";
import { AccountMenu } from "@/components/home/account-menu";
import { LeagueControlPanel } from "@/components/home/league-control-panel";
import { leagueService } from "@/server/services/league-service";

function getGreetingName(displayName: string | null | undefined) {
  const trimmed = displayName?.trim();

  if (!trimmed) {
    return "there";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export default async function HomePage() {
  const session = await getServerAuthSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const greetingName = getGreetingName(session?.user?.displayName);
  const initialLeagues =
    isAuthenticated && session?.user?.id ? await leagueService.listLeaguesForUser(session.user.id) : [];

  return (
    <main className="min-h-screen py-10 sm:py-12">
      <div className={`container flex min-h-screen flex-col ${isAuthenticated ? "justify-start py-4" : "items-center justify-center py-6"}`}>
        <div className={`space-y-8 ${isAuthenticated ? "w-full" : "w-full max-w-5xl"}`}>
          <section className="relative overflow-hidden rounded-[2rem] border border-[#123222] bg-[radial-gradient(circle_at_top_left,rgba(113,255,104,0.22),transparent_28%),linear-gradient(135deg,#081a11_0%,#0d2919_52%,#143222_100%)] shadow-[0_30px_90px_-42px_rgba(1,24,14,0.92)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,204,92,0.06),transparent)] opacity-80" />
            <div className="relative min-h-[320px] sm:min-h-[460px]">
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
              {isAuthenticated && session?.user ? (
                <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
                  <AccountMenu
                    displayName={session.user.displayName}
                    email={session.user.email ?? ""}
                    greetingName={greetingName}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>
        <LeagueControlPanel initialIsAuthenticated={isAuthenticated} initialLeagues={initialLeagues} />
      </div>
    </main>
  );
}
