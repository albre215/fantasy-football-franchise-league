export function getLeagueCodeSchemaHelpMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("leagueCode") &&
    (message.includes("does not exist") ||
      message.includes("Unknown argument") ||
      message.includes("Unknown field") ||
      message.includes("column"))
  ) {
    return "Your local database is missing the new league code field. Stop the dev server, run `npx prisma db push`, then restart the app.";
  }

  return null;
}
