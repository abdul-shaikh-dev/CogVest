import { SettingsScreen } from "@/src/features/settings";
import { getBackupStatusStore } from "@/src/services/backup/backupStatus";

export default function SettingsTabScreen() {
  return <SettingsScreen backupStatusStore={getBackupStatusStore()} />;
}
