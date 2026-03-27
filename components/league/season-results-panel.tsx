"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  IngestionImportType,
  IngestionProvider,
  IngestionRunListResponse,
  PreviewIngestionResponse,
  RunIngestionResponse,
  SaveSeasonSourceConfigResponse,
  SeasonSourceConfigResponse
} from "@/types/ingestion";
import type { LeagueBootstrapMember } from "@/types/league";
import type { SeasonSummary } from "@/types/season";
import type { SeasonResultsResponse } from "@/types/results";

interface SeasonResultsPanelProps {
  activeSeason: SeasonSummary | null;
  members: LeagueBootstrapMember[];
  actingUserId: string;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function seasonLabel(season: SeasonSummary | null) {
  if (!season) {
    return "No active season";
  }

  return season.name ?? `${season.year} Season`;
}

export function SeasonResultsPanel({ activeSeason, members, actingUserId }: SeasonResultsPanelProps) {
  const [provider, setProvider] = useState<IngestionProvider>("CSV");
  const [importType, setImportType] = useState<IngestionImportType>("SEASON_STANDINGS");
  const [externalLeagueId, setExternalLeagueId] = useState("");
  const [externalSeasonKey, setExternalSeasonKey] = useState("");
  const [weekNumber, setWeekNumber] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [preview, setPreview] = useState<PreviewIngestionResponse["preview"] | null>(null);
  const [mappingOverrides, setMappingOverrides] = useState<Record<string, string>>({});
  const [configs, setConfigs] = useState<SeasonSourceConfigResponse["configs"]>([]);
  const [runs, setRuns] = useState<IngestionRunListResponse["runs"]>([]);
  const [results, setResults] = useState<SeasonResultsResponse["results"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRunningImport, setIsRunningImport] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedConfig = configs.find((config) => config.provider === provider) ?? null;
  const trimmedCsvContent = csvContent.trim();
  const hasCsvInput = provider !== "CSV" || Boolean(csvFile) || Boolean(trimmedCsvContent);
  const csvSourceLabel =
    provider !== "CSV"
      ? null
      : csvFile
      ? `Using uploaded file: ${csvFile.name}`
      : trimmedCsvContent
      ? "Using pasted CSV text."
      : "No CSV source selected yet.";
  const mappingMemberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.id,
        label: `${member.displayName} (${member.email})`
      })),
    [members]
  );

  useEffect(() => {
    if (!activeSeason) {
      setConfigs([]);
      setRuns([]);
      setResults(null);
      setPreview(null);
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [configResponse, runsResponse, resultsResponse] = await Promise.all([
          fetch(`/api/season/${activeSeason.id}/ingestion/config`, { cache: "no-store" }),
          fetch(`/api/season/${activeSeason.id}/ingestion/runs`, { cache: "no-store" }),
          fetch(`/api/season/${activeSeason.id}/results`, { cache: "no-store" })
        ]);
        const [configData, runsData, resultsData] = await Promise.all([
          parseJsonResponse<SeasonSourceConfigResponse>(configResponse),
          parseJsonResponse<IngestionRunListResponse>(runsResponse),
          parseJsonResponse<SeasonResultsResponse>(resultsResponse)
        ]);

        setConfigs(configData.configs);
        setRuns(runsData.runs);
        setResults(resultsData.results);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load season ingestion state.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [activeSeason]);

  useEffect(() => {
    if (!selectedConfig) {
      setExternalLeagueId("");
      setExternalSeasonKey("");
      setEspnS2("");
      setSwid("");
      return;
    }

    setExternalLeagueId(selectedConfig.externalLeagueId ?? "");
    setExternalSeasonKey(selectedConfig.externalSeasonKey ?? "");
    setEspnS2(typeof selectedConfig.config.espnS2 === "string" ? selectedConfig.config.espnS2 : "");
    setSwid(typeof selectedConfig.config.swid === "string" ? selectedConfig.config.swid : "");
  }, [selectedConfig]);

  async function refreshResults() {
    if (!activeSeason) {
      return;
    }

    const [configResponse, runsResponse, resultsResponse] = await Promise.all([
      fetch(`/api/season/${activeSeason.id}/ingestion/config`, { cache: "no-store" }),
      fetch(`/api/season/${activeSeason.id}/ingestion/runs`, { cache: "no-store" }),
      fetch(`/api/season/${activeSeason.id}/results`, { cache: "no-store" })
    ]);
    const [configData, runsData, resultsData] = await Promise.all([
      parseJsonResponse<SeasonSourceConfigResponse>(configResponse),
      parseJsonResponse<IngestionRunListResponse>(runsResponse),
      parseJsonResponse<SeasonResultsResponse>(resultsResponse)
    ]);

    setConfigs(configData.configs);
    setRuns(runsData.runs);
    setResults(resultsData.results);
  }

  function buildConfigPayload() {
    return {
      espnS2: espnS2 || null,
      swid: swid || null
    };
  }

  async function resolveCsvContent() {
    if (provider !== "CSV") {
      return undefined;
    }

    if (csvFile) {
      try {
        const fileText = await csvFile.text();

        if (!fileText.trim()) {
          throw new Error("The selected CSV file is empty.");
        }

        return fileText;
      } catch (error) {
        throw new Error(
          error instanceof Error
            ? `Unable to read the selected CSV file. ${error.message}`
            : "Unable to read the selected CSV file."
        );
      }
    }

    if (trimmedCsvContent) {
      return csvContent;
    }

    throw new Error("Please upload a CSV file or paste CSV text before previewing.");
  }

  function clearCsvFile() {
    setCsvFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSaveConfig() {
    if (!activeSeason) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSavingConfig(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/ingestion/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider,
          externalLeagueId,
          externalSeasonKey,
          config: buildConfigPayload(),
          actingUserId
        })
      });

      await parseJsonResponse<SaveSeasonSourceConfigResponse>(response);
      setSuccessMessage("Source configuration saved.");
      await refreshResults();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save source configuration.");
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handlePreviewImport() {
    if (!activeSeason) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const resolvedCsvContent = await resolveCsvContent();
      const response = await fetch(`/api/season/${activeSeason.id}/ingestion/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider,
          importType,
          weekNumber: importType === "WEEKLY_STANDINGS" && weekNumber ? Number(weekNumber) : undefined,
          csvContent: resolvedCsvContent,
          externalLeagueId,
          externalSeasonKey,
          config: buildConfigPayload()
        })
      });
      const data = await parseJsonResponse<PreviewIngestionResponse>(response);

      setPreview(data.preview);
      setMappingOverrides(
        Object.fromEntries(
          data.preview.mappings.map((mapping) => [
            mapping.externalEntityId,
            mapping.matchedLeagueMemberId ?? mapping.suggestedLeagueMemberId ?? ""
          ])
        )
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to preview import.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRunImport() {
    if (!activeSeason) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsRunningImport(true);

    try {
      const resolvedCsvContent = await resolveCsvContent();
      const response = await fetch(`/api/season/${activeSeason.id}/ingestion/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider,
          importType,
          weekNumber: importType === "WEEKLY_STANDINGS" && weekNumber ? Number(weekNumber) : undefined,
          csvContent: resolvedCsvContent,
          externalLeagueId,
          externalSeasonKey,
          config: buildConfigPayload(),
          actingUserId,
          mappingOverrides
        })
      });
      const data = await parseJsonResponse<RunIngestionResponse>(response);

      setSuccessMessage(
        `Import complete. Saved ${data.importedCounts.seasonStandings} season rows and ${data.importedCounts.weeklyStandings} weekly rows.`
      );
      setPreview(null);
      await refreshResults();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to run import.");
    } finally {
      setIsRunningImport(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Season Results & Ingestion</h2>
        <p className="text-muted-foreground">
          Configure a provider, preview imports, review mapping, and store standings/results for {seasonLabel(activeSeason)}.
        </p>
      </div>

      {!activeSeason ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Create or activate a season first. Results ingestion is season-scoped.
          </CardContent>
        </Card>
      ) : (
        <>
          {(errorMessage || successMessage) && (
            <Card className={errorMessage ? "bg-red-50" : "bg-emerald-50"}>
              <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Source Configuration</CardTitle>
                <CardDescription>Choose ESPN, Sleeper, or CSV and save season-level source settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(event) => setProvider(event.target.value as IngestionProvider)}
                    value={provider}
                  >
                    <option value="CSV">CSV</option>
                    <option value="SLEEPER">Sleeper</option>
                    <option value="ESPN">ESPN</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(event) => setImportType(event.target.value as IngestionImportType)}
                    value={importType}
                  >
                    <option value="SEASON_STANDINGS">Season Standings</option>
                    <option value="WEEKLY_STANDINGS">Weekly Results</option>
                  </select>
                  <Input
                    onChange={(event) => setExternalLeagueId(event.target.value)}
                    placeholder="External league ID"
                    value={externalLeagueId}
                  />
                  <Input
                    onChange={(event) => setExternalSeasonKey(event.target.value)}
                    placeholder="External season key"
                    value={externalSeasonKey}
                  />
                  {importType === "WEEKLY_STANDINGS" && (
                    <Input
                      inputMode="numeric"
                      onChange={(event) => setWeekNumber(event.target.value)}
                      placeholder="Week number"
                      value={weekNumber}
                    />
                  )}
                </div>

                {provider === "ESPN" && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input onChange={(event) => setEspnS2(event.target.value)} placeholder="ESPN S2 cookie" value={espnS2} />
                    <Input onChange={(event) => setSwid(event.target.value)} placeholder="SWID cookie" value={swid} />
                  </div>
                )}

                {provider === "CSV" && (
                  <div className="space-y-4 rounded-lg border border-dashed border-border p-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Upload CSV file</p>
                      <p className="text-sm text-muted-foreground">
                        Choose a CSV file from your machine. This is the primary import path.
                      </p>
                      <Input
                        accept=".csv,text/csv"
                        className="cursor-pointer"
                        onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                        ref={fileInputRef}
                        type="file"
                      />
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>{csvFile ? `Selected file: ${csvFile.name}` : "No CSV file selected."}</span>
                        {csvFile ? (
                          <Button onClick={clearCsvFile} type="button" variant="ghost">
                            Clear File
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Or paste CSV manually</p>
                      <p className="text-sm text-muted-foreground">
                        Use this fallback if you do not want to upload a file.
                      </p>
                      <textarea
                        className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        onChange={(event) => setCsvContent(event.target.value)}
                        placeholder="Paste CSV standings or weekly results here."
                        value={csvContent}
                      />
                    </div>

                    <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{csvSourceLabel}</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button disabled={isSavingConfig} onClick={() => void handleSaveConfig()} type="button" variant="outline">
                    Save Source Config
                  </Button>
                  <Button disabled={isLoading || !hasCsvInput} onClick={() => void handlePreviewImport()} type="button">
                    Preview Import
                  </Button>
                  <Button
                    disabled={isRunningImport || !preview || !hasCsvInput}
                    onClick={() => void handleRunImport()}
                    type="button"
                    variant="secondary"
                  >
                    Run Import
                  </Button>
                </div>

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  CSV is the reliable fallback. Sleeper is the cleanest supported API path. ESPN is supported defensively and may need CSV fallback if the provider response is incomplete.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import Summary</CardTitle>
                <CardDescription>Review provider status, mapping readiness, and stored result coverage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Active season: {seasonLabel(activeSeason)}</p>
                <p>Provider configs saved: {configs.length}</p>
                <p>Import runs tracked: {runs.length}</p>
                <p>Season standings stored: {results?.seasonStandings.length ?? 0}</p>
                <p>Weekly standings stored: {results?.weeklyStandings.length ?? 0}</p>
                <p>Draft order ready: {results?.availability.isReadyForDraftOrderAutomation ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Mapping Review</CardTitle>
                <CardDescription>Confirm how imported external records map to league members before persistence.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!preview ? (
                  <p className="text-sm text-muted-foreground">Preview an import first to review member mappings.</p>
                ) : (
                  <>
                    <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                      <p>Provider: {preview.provider}</p>
                      <p>Import type: {preview.importType}</p>
                      <p>Records previewed: {preview.sourceSummary.recordCount}</p>
                      <p>Warnings: {preview.warnings.length === 0 ? "None" : preview.warnings.join(", ")}</p>
                    </div>
                    {preview.mappings.map((mapping) => (
                      <div className="rounded-lg border border-border p-4 text-sm" key={mapping.externalEntityId}>
                        <p className="font-medium text-foreground">{mapping.externalDisplayName}</p>
                        <p className="text-muted-foreground">
                          Status: {mapping.status}
                          {mapping.confidenceScore !== null ? ` (${mapping.confidenceScore}% confidence)` : ""}
                        </p>
                        <select
                          className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(event) =>
                            setMappingOverrides((current) => ({
                              ...current,
                              [mapping.externalEntityId]: event.target.value
                            }))
                          }
                          value={mappingOverrides[mapping.externalEntityId] ?? ""}
                        >
                          <option value="">Select league member</option>
                          {mappingMemberOptions.map((memberOption) => (
                            <option key={memberOption.id} value={memberOption.id}>
                              {memberOption.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import History</CardTitle>
                <CardDescription>Recent ingestion runs and provider troubleshooting notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No imports have been run for this season yet.</p>
                ) : (
                  runs.map((run) => (
                    <div className="rounded-lg border border-border p-4 text-sm" key={run.id}>
                      <p className="font-medium text-foreground">
                        {run.provider} - {run.importType}
                        {run.weekNumber ? ` (Week ${run.weekNumber})` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {run.status} - {new Date(run.startedAt).toLocaleString()}
                      </p>
                      {run.errorMessage ? <p className="text-red-600">{run.errorMessage}</p> : null}
                      {run.warnings.length > 0 ? (
                        <p className="text-muted-foreground">Warnings: {run.warnings.join(", ")}</p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>Season Standings</CardTitle>
                <CardDescription>Stored results that Prompt 7 analytics and Prompt 9 draft order can build on.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading results...</p>
                ) : !results || results.seasonStandings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No season standings have been imported yet.</p>
                ) : (
                  results.seasonStandings.map((standing) => (
                    <div className="rounded-lg border border-border p-4 text-sm" key={standing.leagueMemberId}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {standing.rank ? `#${standing.rank} ` : ""}
                            {standing.displayName}
                          </p>
                          <p className="text-muted-foreground">{standing.provider}</p>
                        </div>
                        <div className="text-right text-muted-foreground">
                          <p>
                            Record: {standing.wins ?? "-"}-{standing.losses ?? "-"}
                            {standing.ties ? `-${standing.ties}` : ""}
                          </p>
                          <p>
                            PF/PA: {standing.pointsFor ?? "-"} / {standing.pointsAgainst ?? "-"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-muted-foreground">
                        <p>Playoff finish: {standing.playoffFinish ?? "Not available"}</p>
                        <p>Champion: {standing.isChampion === null ? "Not available" : standing.isChampion ? "Yes" : "No"}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Results-Based Analytics Preview</CardTitle>
                <CardDescription>What is now available and what still depends on fuller ingestion.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Season standings available: {results?.availability.hasSeasonStandings ? "Yes" : "No"}</p>
                <p>Weekly standings available: {results?.availability.hasWeeklyStandings ? "Yes" : "No"}</p>
                <p>Champion data available: {results?.availability.hasChampionData ? "Yes" : "No"}</p>
                <p>Playoff finish available: {results?.availability.hasPlayoffData ? "Yes" : "No"}</p>
                <div className="rounded-lg border border-dashed border-border p-4">
                  {results?.availability.isReadyForDraftOrderAutomation
                    ? "This season has enough final standings shape to support reverse-order draft logic later."
                    : "Import complete final standings with ranking to fully support Prompt 9 draft-order automation."}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
