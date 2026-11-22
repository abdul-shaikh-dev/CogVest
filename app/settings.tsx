import { SettingsScreen as SettingsFeatureScreen } from "@/src/features/settings";
import { getBackupStatusStore } from "@/src/services/backup/backupStatus";
import { getAppLockStore } from "@/src/services/security/appLock";

export default function SettingsScreen() {
  return <SettingsFeatureScreen appLockStore={getAppLockStore()} backupStatusStore={getBackupStatusStore()} />;
}
