import { router, useLocalSearchParams } from "expo-router";

import {
  BackupScreen,
  type LockedRestore,
  type PreparedRestore,
} from "@/src/features/backup/BackupScreen";
import {
  exportPortfolioBackup,
  restorePortfolioBackup,
  selectPortfolioBackup,
  unlockPortfolioBackup,
} from "@/src/services/backup";

export default function BackupRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string | string[] }>();
  const initialMode = mode === "restore" ? "restore" : "export";

  return (
    <BackupScreen
      exportPortfolioBackup={(signal, options) => exportPortfolioBackup(signal, options)}
      initialMode={initialMode}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/settings");
      }}
      onRestored={() => {
        router.dismissAll();
        router.replace("/");
      }}
      restorePortfolioBackup={(prepared: PreparedRestore, signal) =>
        restorePortfolioBackup(prepared, signal)
      }
      selectPortfolioBackup={(signal) => selectPortfolioBackup(signal)}
      unlockPortfolioBackup={(locked: LockedRestore, passphrase, signal) =>
        unlockPortfolioBackup(locked, passphrase, signal)
      }
    />
  );
}
