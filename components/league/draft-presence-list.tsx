"use client";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import type { InauguralAuctionOwnerSummary } from "@/types/inaugural-auction";

interface DraftPresenceListProps {
  owners: InauguralAuctionOwnerSummary[];
  presentMemberIds: string[];
  viewerMemberId: string | null;
}

export function DraftPresenceList({ owners, presentMemberIds, viewerMemberId }: DraftPresenceListProps) {
  const presentSet = new Set(presentMemberIds);
  const sorted = [...owners].sort((left, right) => {
    const leftPresent = presentSet.has(left.leagueMemberId) ? 0 : 1;
    const rightPresent = presentSet.has(right.leagueMemberId) ? 0 : 1;
    if (leftPresent !== rightPresent) return leftPresent - rightPresent;
    return left.displayName.localeCompare(right.displayName);
  });

  return (
    <div className="space-y-2 rounded-lg border border-border bg-white/60 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Draft Lobby</h3>
        <span className="text-xs text-muted-foreground">
          {presentMemberIds.length}/{owners.length} present
        </span>
      </div>
      <ul className="space-y-1.5">
        {sorted.map((owner) => {
          const isPresent = presentSet.has(owner.leagueMemberId);
          const isViewer = owner.leagueMemberId === viewerMemberId;
          return (
            <li
              key={owner.leagueMemberId}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                isPresent ? "bg-emerald-50" : "bg-slate-50 text-slate-500"
              }`}
            >
              <div className="relative">
                <ProfileAvatar
                  className={`h-8 w-8 border-2 ${
                    isPresent
                      ? "border-emerald-500 bg-slate-100 text-slate-700"
                      : "border-slate-300 bg-slate-100 text-slate-500 grayscale"
                  }`}
                  imageUrl={owner.profileImageUrl}
                  name={owner.displayName}
                />
                <span
                  aria-hidden
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    isPresent ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {owner.displayName}
                  {isViewer ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  ${owner.budgetRemaining} • {owner.teamCount}/3 teams
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
