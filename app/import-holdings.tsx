import { File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";

import {
  HoldingImportScreen,
  holdingsCsvMaxBytes,
} from "@/src/features/holdingImport";
import { getQuickSetupSessionStore } from "@/src/features/quickSetup";
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

    if (selected.size > holdingsCsvMaxBytes) {
      return { name, size: selected.size, text: "" };
    }

    return {
      name,
      size: selected.size,
      text: await selected.text(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/cancelled|canceled/iu.test(message)) return undefined;
    throw error;
  }
}

export default function ImportHoldingsRoute() {
  const params = useLocalSearchParams<{
    token?: string;
    visualQaState?: string;
  }>();
  const visualQaState = canUseVisualQaHarness({
    isDevelopment: __DEV__,
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
      pickCsvFile={pickCsvFile}
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
