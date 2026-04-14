function getSecondSundayOfFebruary(year: number) {
  const februaryFirst = new Date(year, 1, 1);
  const firstSundayOffset = (7 - februaryFirst.getDay()) % 7;

  return new Date(year, 1, 1 + firstSundayOffset + 7);
}

export function getCurrentGmFantasySeasonYear(referenceDate: Date = new Date()) {
  const currentDate = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const secondSundayOfFebruary = getSecondSundayOfFebruary(currentDate.getFullYear());
  const seasonRolloverDate = new Date(
    secondSundayOfFebruary.getFullYear(),
    secondSundayOfFebruary.getMonth(),
    secondSundayOfFebruary.getDate() + 1
  );

  return currentDate >= seasonRolloverDate ? currentDate.getFullYear() : currentDate.getFullYear() - 1;
}
