import type { ImportFileKind } from "@/src/domain/importFileDetection";

/** Where a detected file goes (#771). Every destination is a review: nothing is saved here. */
export type ImportFileDestination = {
  params: Record<string, string>;
  pathname: "/epf-import" | "/import-holdings" | "/import-ppf" | "/import-transactions";
};

export type ImportFileRoute =
  | ({ kind: "open" } & ImportFileDestination)
  | { kind: "choosePdf" }
  | { kind: "choosePpfAccount"; accounts: { id: string; nickname: string }[] }
  | { kind: "message"; message: string };

export const casDestination: ImportFileDestination = {
  params: { file: "1", source: "camsKfinCasPdfV1" },
  pathname: "/import-transactions",
};
export const epfDestination: ImportFileDestination = { params: { file: "1" }, pathname: "/epf-import" };
export function ppfDestination(accountId: string): ImportFileDestination {
  return { params: { accountId, file: "1" }, pathname: "/import-ppf" };
}

export const supportedImportFilesText =
  "CAMS + KFintech CAS PDF, Zerodha tradebook CSV, EPF passbook PDF, PPF statement CSV, and CogVest holdings or transactions CSV";

export function routeForImportFile(
  kind: ImportFileKind,
  ppfAccounts: readonly { id: string; nickname: string }[],
): ImportFileRoute {
  switch (kind) {
    case "holdingsCsv":
      return { kind: "open", params: { file: "1" }, pathname: "/import-holdings" };
    case "transactionsCsv":
      return { kind: "open", params: { file: "1", source: "cogvestCsvV1" }, pathname: "/import-transactions" };
    case "zerodhaTradebook":
      return { kind: "open", params: { file: "1", source: "zerodhaTradebookEqV1" }, pathname: "/import-transactions" };
    case "casPdf":
      return { kind: "open", ...casDestination };
    case "pdf":
      return { kind: "choosePdf" };
    case "ppfCsv":
      if (ppfAccounts.length === 1) return { kind: "open", ...ppfDestination(ppfAccounts[0].id) };
      if (ppfAccounts.length === 0) {
        return {
          kind: "message",
          message: "This is a PPF statement. Add the PPF account under Holdings first, then import the file again.",
        };
      }
      return { accounts: ppfAccounts.map(({ id, nickname }) => ({ id, nickname })), kind: "choosePpfAccount" };
    case "spreadsheet":
      return {
        kind: "message",
        message: "CogVest can't read spreadsheet files. Open it in a spreadsheet app, save it as CSV, then import the CSV.",
      };
    case "unknown":
      return {
        kind: "message",
        message: `CogVest doesn't recognise this file, so nothing was imported. Supported: ${supportedImportFilesText}.`,
      };
  }
}
