import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth-session";
import { OwnerDashboard } from "@/components/owner/owner-dashboard";
import { ownerService, OwnerServiceError } from "@/server/services/owner-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OwnerPage({
  searchParams
}: {
  searchParams?: { seasonId?: string };
}) {
  try {
    const user = await requireAuthenticatedUser();
    const dashboard = await ownerService.getOwnerDashboard(user.id);
    const requestedSeasonId = typeof searchParams?.seasonId === "string" ? searchParams.seasonId : null;
    const selectedSeasonId = requestedSeasonId ?? dashboard.featuredSeasonId;
    let seasonDetail = null;

    if (selectedSeasonId) {
      try {
        seasonDetail = await ownerService.getOwnerSeasonContext(user.id, selectedSeasonId);
      } catch (error) {
        if (!(error instanceof OwnerServiceError)) {
          throw error;
        }
      }
    }

    return <OwnerDashboard dashboard={dashboard} seasonDetail={seasonDetail} />;
  } catch {
    redirect("/");
  }
}
