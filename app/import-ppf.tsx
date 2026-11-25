import { router, useLocalSearchParams } from "expo-router";
import { PpfImportScreen } from "@/src/features/ppf/PpfImportScreen";
import { pickPpfCsvFile, readPpfCsvFile, savePpfCsvTemplate } from "@/src/services/import-export/ppfCsvFile";
import { withPendingFile } from "@/src/services/import-export/pendingImportFile";

const pickPendingOrPpfCsvFile = withPendingFile(readPpfCsvFile, pickPpfCsvFile);

export default function ImportPpfRoute() {
  const { accountId, file } = useLocalSearchParams<{ accountId?: string; file?: string }>();
  return <PpfImportScreen
    key={accountId ?? "missing"}
    accountId={accountId ?? ""}
    autoSelect={file === "1"}
    onCancel={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/holdings"); }}
    onImported={(savedId) => {
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/ppf-account", params: { accountId: savedId } });
    }}
    pickCsvFile={file === "1" ? pickPendingOrPpfCsvFile : pickPpfCsvFile}
    saveCsvTemplate={savePpfCsvTemplate}
  />;
}
