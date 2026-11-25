import { Directory, File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";

import {
  HoldingImportScreen,
  holdingsCsvMaxBytes,
} from "@/src/features/holdingImport";
import {
  holdingsCsvTemplate,
  holdingsCsvTemplateFileName,
} from "@/src/domain/holdingsCsvTemplate";
import { getQuickSetupSessionStore } from "@/src/features/quickSetup";
import { readPickedCsvFile } from "@/src/services/import-export/boundedTextFile";
import type { ImportFileRef } from "@/src/services/import-export/importFileProbe";
import { withPendingFile } from "@/src/services/import-export/pendingImportFile";
import {
  canUseVisualQaHarness,
  resolveVisualQaQuote,
  visualQaAssetLookupResults,
} from "@/src/testing/visualQaSeed";

async function pickCsvFile() {
  try {
    const picked = await File.pickFileAsync(undefined, "text/*");
    const selected = Array.isArray(picked) ? picked[0] : picked;
    if (!selected) return undefined;
    const selectedWithName = selected as typeof selected & { name?: string };
    const decodedUri = decodeURIComponent(selected.uri);
    const uriName = decodedUri.split(/[\\/]/u).at(-1);
    const selectedName = selectedWithName.name?.trim();
    const name = selectedName && /\.csv$/iu.test(selectedName)
      ? selectedName
      : uriName && /\.csv$/iu.test(uriName)
        ? uriName
        : "Selected CSV file";

    return { name, ...(await readPickedCsvFile(selected, holdingsCsvMaxBytes)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/cancelled|canceled/iu.test(message)) return undefined;
    throw error;
  }
}

async function readCsvFile(file: ImportFileRef) {
  return { name: file.name, ...(await readPickedCsvFile({ size: file.size ?? undefined, uri: file.uri }, holdingsCsvMaxBytes)) };
}

const pickPendingOrCsvFile = withPendingFile(readCsvFile, pickCsvFile);

async function saveCsvTemplate() {
  try {
    const directory = await Directory.pickDirectoryAsync();
    const file = directory.createFile(holdingsCsvTemplateFileName, "text/csv");
    await file.write(holdingsCsvTemplate);
    return holdingsCsvTemplateFileName;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/cancelled|canceled/iu.test(message)) return undefined;
    throw error;
  }
}

export default function ImportHoldingsRoute() {
  const params = useLocalSearchParams<{
    file?: string;
    token?: string;
    visualQaState?: string;
  }>();
  const visualQaState = canUseVisualQaHarness({
    token: params.token,
  })
    ? params.visualQaState
    : undefined;

  return (
    <HoldingImportScreen
      now={visualQaState ? () => new Date("2026-05-29T10:15:00.000Z") : undefined}
      onCancel={() => router.back()}
      onImported={({ items }) => {
        const sessionStore = getQuickSetupSessionStore();
        for (const item of items) {
          sessionStore.getState().recordItem({
            assetId: item.asset.id,
            kind: "openingPosition",
            name: item.asset.name,
            recordId: item.openingPosition.id,
          });
        }
        sessionStore.getState().showReview();
        router.replace("/quick-portfolio-setup");
      }}
      autoSelect={params.file === "1"}
      pickCsvFile={params.file === "1" ? pickPendingOrCsvFile : pickCsvFile}
      saveCsvTemplate={saveCsvTemplate}
      resolveQuote={
        visualQaState === "lookup"
          ? async ({ asset }) => resolveVisualQaQuote(asset)
          : undefined
      }
      searchAssetLookupResults={
        visualQaState === "lookup"
          ? async () => ({ failures: [], results: visualQaAssetLookupResults })
          : visualQaState === "lookup-failure"
            ? async () => ({ failures: ["Provider unavailable"], results: [] })
            : undefined
      }
    />
  );
}
