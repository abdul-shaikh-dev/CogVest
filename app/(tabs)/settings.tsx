import { SettingsScreen } from "@/src/features/settings";
import { getBackupStatusStore } from "@/src/services/backup/backupStatus";
import { getAppLockStore } from "@/src/services/security/appLock";

export default function SettingsTabScreen() {
  return <SettingsScreen appLockStore={getAppLockStore()} backupStatusStore={getBackupStatusStore()} />;
}
