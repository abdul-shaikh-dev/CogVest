import { File } from "expo-file-system";
import { router } from "expo-router";

import { EpfPassbookImportScreen } from "@/src/features/epfImport";

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

export default function EpfImportRoute() {
  return (
    <EpfPassbookImportScreen
      onBack={() => router.back()}
      onComplete={(accountId) => router.replace({ pathname: "/epf-account", params: { accountId } })}
      pickPassbooks={pickPassbooks}
    />
  );
}
