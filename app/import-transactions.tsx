import { Directory, File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import { transactionCsvTemplate, transactionCsvTemplateFileName } from "@/src/domain/transactionCsvTemplate";
import { TransactionImportScreen, transactionCsvMaxBytes } from "@/src/features/transactionImport";
import type { TransactionImportSourceId } from "@/src/domain/transactionImportSources";
import { readPickedCsvFile } from "@/src/services/import-export/boundedTextFile";
import type { ImportFileRef } from "@/src/services/import-export/importFileProbe";
import { withPendingFile } from "@/src/services/import-export/pendingImportFile";

const detectedSources = new Set<TransactionImportSourceId>(["camsKfinCasPdfV1", "cogvestCsvV1", "zerodhaTradebookEqV1"]);

async function readCsvFile(file: ImportFileRef) {
  return { name: file.name, ...(await readPickedCsvFile({ size: file.size ?? undefined, uri: file.uri }, transactionCsvMaxBytes)) };
}

async function readCasStatement(file: ImportFileRef) {
  return { size: file.size ?? new File(file.uri).size, uri: file.uri };
}

async function pickCsvFile() {
  try {
    const picked = await File.pickFileAsync(undefined, "text/*");
    const selected = Array.isArray(picked) ? picked[0] : picked;
    if (!selected) return undefined;
    const named = selected as typeof selected & { name?: string };
    const uriName = decodeURIComponent(selected.uri).split(/[\\/]/u).at(-1);
    const name = named.name?.trim() || uriName || "Selected CSV file";
    return { name, ...(await readPickedCsvFile(selected, transactionCsvMaxBytes)) };
  } catch (error) {
    if (/cancelled|canceled/iu.test(error instanceof Error ? error.message : "")) return undefined;
    throw error;
  }
}

async function pickCasStatement() {
  try {
    const picked = await File.pickFileAsync(undefined, "application/pdf");
    const selected = Array.isArray(picked) ? picked[0] : picked;
    if (!selected) return undefined;
    return { size: selected.size, uri: selected.uri };
  } catch (error) {
    if (/cancelled|canceled/iu.test(error instanceof Error ? error.message : "")) return undefined;
    throw error;
  }
}

async function saveCsvTemplate() {
  try {
    const directory = await Directory.pickDirectoryAsync();
    const file = directory.createFile(transactionCsvTemplateFileName, "text/csv");
    await file.write(transactionCsvTemplate);
    return transactionCsvTemplateFileName;
  } catch (error) {
    if (/cancelled|canceled/iu.test(error instanceof Error ? error.message : "")) return undefined;
    throw error;
  }
}

export default function ImportTransactionsRoute() {
  // Set by "Import a file" (#771): the file is already chosen and detected.
  const params = useLocalSearchParams<{ file?: string; source?: string }>();
  const fromImportFile = params.file === "1";
  const source = detectedSources.has(params.source as TransactionImportSourceId)
    ? params.source as TransactionImportSourceId
    : undefined;
  const pickers = useMemo(() => fromImportFile
    ? { cas: withPendingFile(readCasStatement, pickCasStatement), csv: withPendingFile(readCsvFile, pickCsvFile) }
    : { cas: pickCasStatement, csv: pickCsvFile }, [fromImportFile]);
  return <TransactionImportScreen
    autoSelect={fromImportFile}
    initialSourceId={source}
    onAddPpfAccount={() => router.push("/ppf-account")}
    onCancel={() => router.back()}
    onImported={() => router.replace({ pathname: "/(tabs)/holdings", params: { status: "transactionsImported" } })}
    pickCasStatement={pickers.cas}
    pickCsvFile={pickers.csv}
    saveCsvTemplate={saveCsvTemplate}
  />;
}
