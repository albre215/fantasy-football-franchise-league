import { PrismaClient, NFLConference } from "@prisma/client";

const prisma = new PrismaClient();

const nflTeams = [
  { name: "Arizona Cardinals", abbreviation: "ARI", conference: NFLConference.NFC, division: "West" },
  { name: "Atlanta Falcons", abbreviation: "ATL", conference: NFLConference.NFC, division: "South" },
  { name: "Baltimore Ravens", abbreviation: "BAL", conference: NFLConference.AFC, division: "North" },
  { name: "Buffalo Bills", abbreviation: "BUF", conference: NFLConference.AFC, division: "East" },
  { name: "Carolina Panthers", abbreviation: "CAR", conference: NFLConference.NFC, division: "South" },
  { name: "Chicago Bears", abbreviation: "CHI", conference: NFLConference.NFC, division: "North" },
  { name: "Cincinnati Bengals", abbreviation: "CIN", conference: NFLConference.AFC, division: "North" },
  { name: "Cleveland Browns", abbreviation: "CLE", conference: NFLConference.AFC, division: "North" },
  { name: "Dallas Cowboys", abbreviation: "DAL", conference: NFLConference.NFC, division: "East" },
  { name: "Denver Broncos", abbreviation: "DEN", conference: NFLConference.AFC, division: "West" },
  { name: "Detroit Lions", abbreviation: "DET", conference: NFLConference.NFC, division: "North" },
  { name: "Green Bay Packers", abbreviation: "GB", conference: NFLConference.NFC, division: "North" },
  { name: "Houston Texans", abbreviation: "HOU", conference: NFLConference.AFC, division: "South" },
  { name: "Indianapolis Colts", abbreviation: "IND", conference: NFLConference.AFC, division: "South" },
  { name: "Jacksonville Jaguars", abbreviation: "JAX", conference: NFLConference.AFC, division: "South" },
  { name: "Kansas City Chiefs", abbreviation: "KC", conference: NFLConference.AFC, division: "West" },
  { name: "Las Vegas Raiders", abbreviation: "LV", conference: NFLConference.AFC, division: "West" },
  { name: "Los Angeles Chargers", abbreviation: "LAC", conference: NFLConference.AFC, division: "West" },
  { name: "Los Angeles Rams", abbreviation: "LAR", conference: NFLConference.NFC, division: "West" },
  { name: "Miami Dolphins", abbreviation: "MIA", conference: NFLConference.AFC, division: "East" },
  { name: "Minnesota Vikings", abbreviation: "MIN", conference: NFLConference.NFC, division: "North" },
  { name: "New England Patriots", abbreviation: "NE", conference: NFLConference.AFC, division: "East" },
  { name: "New Orleans Saints", abbreviation: "NO", conference: NFLConference.NFC, division: "South" },
  { name: "New York Giants", abbreviation: "NYG", conference: NFLConference.NFC, division: "East" },
  { name: "New York Jets", abbreviation: "NYJ", conference: NFLConference.AFC, division: "East" },
  { name: "Philadelphia Eagles", abbreviation: "PHI", conference: NFLConference.NFC, division: "East" },
  { name: "Pittsburgh Steelers", abbreviation: "PIT", conference: NFLConference.AFC, division: "North" },
  { name: "San Francisco 49ers", abbreviation: "SF", conference: NFLConference.NFC, division: "West" },
  { name: "Seattle Seahawks", abbreviation: "SEA", conference: NFLConference.NFC, division: "West" },
  { name: "Tampa Bay Buccaneers", abbreviation: "TB", conference: NFLConference.NFC, division: "South" },
  { name: "Tennessee Titans", abbreviation: "TEN", conference: NFLConference.AFC, division: "South" },
  { name: "Washington Commanders", abbreviation: "WAS", conference: NFLConference.NFC, division: "East" }
] as const;

async function main() {
  for (const team of nflTeams) {
    await prisma.nFLTeam.upsert({
      where: {
        abbreviation: team.abbreviation
      },
      update: {
        name: team.name,
        conference: team.conference,
        division: team.division,
        isActive: true
      },
      create: {
        name: team.name,
        abbreviation: team.abbreviation,
        conference: team.conference,
        division: team.division
      }
    });
  }
}

main()
  .catch(async (error) => {
    console.error("Failed to seed NFL teams.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
