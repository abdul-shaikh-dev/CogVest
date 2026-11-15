import { Directory, File } from "expo-file-system";
import { router } from "expo-router";

import { transactionCsvTemplate, transactionCsvTemplateFileName } from "@/src/domain/transactionCsvTemplate";
import { TransactionImportScreen, transactionCsvMaxBytes } from "@/src/features/transactionImport";
import { readPickedCsvFile } from "@/src/services/import-export/boundedTextFile";

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
  return <TransactionImportScreen
    onAddPpfAccount={() => router.push("/ppf-account")}
    onCancel={() => router.back()}
    onImported={() => router.replace({ pathname: "/(tabs)/holdings", params: { status: "transactionsImported" } })}
    pickCasStatement={pickCasStatement}
    pickCsvFile={pickCsvFile}
    saveCsvTemplate={saveCsvTemplate}
  />;
}
