import { SettingsScreen as SettingsFeatureScreen } from "@/src/features/settings";
import { getBackupStatusStore } from "@/src/services/backup/backupStatus";

export default function SettingsScreen() {
  return <SettingsFeatureScreen backupStatusStore={getBackupStatusStore()} />;
}
