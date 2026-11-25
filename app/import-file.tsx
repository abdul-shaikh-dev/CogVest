import { File } from "expo-file-system";
import { router } from "expo-router";

import { ImportFileScreen } from "@/src/features/importFile";
import { probeImportFile, type ImportFileRef } from "@/src/services/import-export/importFileProbe";
import { setPendingImportFile, takePendingImportFile } from "@/src/services/import-export/pendingImportFile";

async function pickFile(): Promise<ImportFileRef | undefined> {
  try {
    const picked = await File.pickFileAsync(undefined, "*/*");
    const selected = Array.isArray(picked) ? picked[0] : picked;
    if (!selected) return undefined;
    const named = selected as typeof selected & { name?: string; type?: string | null };
    const uriName = decodeURIComponent(selected.uri).split(/[\\/]/u).at(-1);
    return {
      mimeType: named.type ?? null,
      name: named.name?.trim() || uriName || "Selected file",
      size: selected.size,
      uri: selected.uri,
    };
  } catch (error) {
    if (/cancelled|canceled/iu.test(error instanceof Error ? error.message : "")) return undefined;
    throw error;
  }
}

/** "Import a file" and the share target (#771). */
export default function ImportFileRoute() {
  return (
    <ImportFileScreen
      onBack={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/settings"); }}
      onOpen={(file, destination) => {
        setPendingImportFile(file);
        router.replace({ pathname: destination.pathname, params: destination.params });
      }}
      pickFile={pickFile}
      probeFile={(file) => probeImportFile(file)}
      takeSharedFile={takePendingImportFile}
    />
  );
}
