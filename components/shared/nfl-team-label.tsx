import Image from "next/image";

import { getNFLTeamLogoUrl, normalizeNFLTeamAbbreviation } from "@/lib/nfl-team-logos";
import { cn } from "@/lib/utils";

type TeamLabelSize = "compact" | "default" | "detail";

interface TeamIdentity {
  abbreviation: string;
  name: string;
}

interface NFLTeamLogoProps {
  abbreviation: string;
  name: string;
  size?: TeamLabelSize;
  className?: string;
}

interface NFLTeamLabelProps {
  team: TeamIdentity;
  size?: TeamLabelSize;
  className?: string;
  textClassName?: string;
}

const sizeMap: Record<TeamLabelSize, { image: number; className: string }> = {
  compact: {
    image: 18,
    className: "h-[18px] w-[18px]"
  },
  default: {
    image: 20,
    className: "h-5 w-5"
  },
  detail: {
    image: 24,
    className: "h-6 w-6"
  }
};

export function NFLTeamLogo({
  abbreviation,
  name,
  size = "default",
  className
}: NFLTeamLogoProps) {
  const normalizedAbbreviation = normalizeNFLTeamAbbreviation(abbreviation);
  const logoUrl = getNFLTeamLogoUrl(normalizedAbbreviation);
  const dimensions = sizeMap[size];

  if (!logoUrl) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold uppercase text-muted-foreground",
          dimensions.className,
          className
        )}
      >
        {normalizedAbbreviation.slice(0, 2)}
      </span>
    );
  }

  return (
    <Image
      alt={`${name} logo`}
      className={cn("shrink-0 object-contain", dimensions.className, className)}
      height={dimensions.image}
      src={logoUrl}
      unoptimized
      width={dimensions.image}
    />
  );
}

export function NFLTeamLabel({
  team,
  size = "default",
  className,
  textClassName
}: NFLTeamLabelProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 align-middle", className)}>
      <NFLTeamLogo abbreviation={team.abbreviation} name={team.name} size={size} />
      <span className={cn("min-w-0", textClassName)}>
        {normalizeNFLTeamAbbreviation(team.abbreviation)} - {team.name}
      </span>
    </span>
  );
}
