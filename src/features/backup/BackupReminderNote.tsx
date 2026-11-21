import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, PremiumCard } from "@/src/components/common";
import type { BackupReminder } from "@/src/domain/backupReminder";
import type { BackupStatusState } from "@/src/services/backup/backupStatus";
import type { PortfolioStoreState } from "@/src/store";
import { spacing } from "@/src/theme";

import { useBackupReminder } from "./useBackupReminder";

type DueReminder = Extract<BackupReminder, { due: true }>;

export function backupReminderCopy(reminder: DueReminder) {
  const days = reminder.daysSinceBackup === 1 ? "1 day" : `${reminder.daysSinceBackup} days`;
  const records = reminder.recordsAdded === 1 ? "1 record" : `${reminder.recordsAdded} records`;
  switch (reminder.reason) {
    case "never":
      return {
        title: "Back up your portfolio",
        message: "Your records are only on this phone. A backup lets you restore them if it is lost or reset.",
      };
    case "days":
      return {
        title: `Last backup ${days} ago`,
        message: "Your portfolio has changed since then. Save a new backup to keep it safe.",
      };
    case "records":
      return {
        title: `${records} added since your last backup`,
        message: "Save a new backup so they are not lost with this phone.",
      };
  }
}

/** A quiet Dashboard note when a backup is due (#759). It never blocks tracking. */
export function BackupReminderNote({
  backupStatusStore,
  minimalMode,
  now,
  onBackUp = () => router.push("/backup?mode=export"),
  store,
}: {
  backupStatusStore: StoreApi<BackupStatusState>;
  minimalMode: boolean;
  now: Date;
  onBackUp?: () => void;
  store: StoreApi<PortfolioStoreState>;
}) {
  const { reminder, snooze } = useBackupReminder({ backupStatusStore, minimalMode, now, store });
  if (!reminder.due) return null;
  const copy = backupReminderCopy(reminder);

  return (
    <PremiumCard testID="dashboard-backup-reminder">
      <AppText weight="bold">{copy.title}</AppText>
      <AppText color="secondary" variant="caption">{copy.message}</AppText>
      <View style={styles.actions}>
        <AppButton onPress={onBackUp} testID="dashboard-backup-reminder-backup" title="Back up now" variant="secondary" />
        <AppButton
          onPress={() => {
            // A failed save keeps the note; it reappears rather than claiming a snooze.
            try { snooze(); } catch { /* Nothing to undo. */ }
          }}
          testID="dashboard-backup-reminder-dismiss"
          title="Not now"
          variant="ghost"
        />
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
