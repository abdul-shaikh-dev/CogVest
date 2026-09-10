import { router, useLocalSearchParams } from "expo-router";
import { PpfImportScreen } from "@/src/features/ppf/PpfImportScreen";
import { pickPpfCsvFile, savePpfCsvTemplate } from "@/src/services/import-export/ppfCsvFile";

export default function ImportPpfRoute() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  return <PpfImportScreen
    key={accountId ?? "missing"}
    accountId={accountId ?? ""}
    onCancel={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/holdings"); }}
    onImported={(savedId) => {
      if (router.canGoBack()) router.back();
      else router.replace({ pathname: "/ppf-account", params: { accountId: savedId } });
    }}
    pickCsvFile={pickPpfCsvFile}
    saveCsvTemplate={savePpfCsvTemplate}
  />;
}
