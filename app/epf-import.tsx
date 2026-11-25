import { File } from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";

import { EpfPassbookImportScreen } from "@/src/features/epfImport";
import type { ImportFileRef } from "@/src/services/import-export/importFileProbe";
import { withPendingFile } from "@/src/services/import-export/pendingImportFile";

async function pickPassbooks() {
  try {
    const picked = await File.pickFileAsync({ multipleFiles: true, mimeTypes: "application/pdf" });
    if (picked.canceled) return [];
    return picked.result.map((file) => {
      const named = file as typeof file & { name?: string };
      const uriName = decodeURIComponent(file.uri).split(/[\\/]/u).at(-1);
      return { name: named.name?.trim() || uriName || "Selected PDF", size: file.size, uri: file.uri };
    });
  } catch (error) {
    if (/cancelled|canceled/iu.test(error instanceof Error ? error.message : "")) return [];
    throw error;
  }
}

// A passbook chosen under "Import a file" (#771), read first; later picks use the system picker.
const pickPendingOrPassbooks = withPendingFile(
  async (file: ImportFileRef) => [{ name: file.name, size: file.size ?? new File(file.uri).size, uri: file.uri }],
  pickPassbooks,
);

export default function EpfImportRoute() {
  const { file } = useLocalSearchParams<{ file?: string }>();
  return (
    <EpfPassbookImportScreen
      autoSelect={file === "1"}
      onBack={() => router.back()}
      onComplete={(accountId) => router.replace({ pathname: "/epf-account", params: { accountId } })}
      pickPassbooks={async () => (await (file === "1" ? pickPendingOrPassbooks : pickPassbooks)()) ?? []}
    />
  );
}
