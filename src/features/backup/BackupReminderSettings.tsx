import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppText } from "@/src/components/common";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { backupReminderDayOptions, type BackupReminderDays } from "@/src/domain/backupReminder";
import { formatDate } from "@/src/domain/formatters";
import { useBackupStatus, type BackupStatusState } from "@/src/services/backup/backupStatus";
import { interaction, spacing, useTheme } from "@/src/theme";

const optionLabel = (days: BackupReminderDays) => (days === 0 ? "Off" : `After ${days} days`);

/** "Last backup" and the reminder interval, in Settings (#759). */
export function BackupReminderSettings({ backupStatusStore }: { backupStatusStore: StoreApi<BackupStatusState> }) {
  const { colors } = useTheme();
  const { status, setReminderDays } = useBackupStatus(backupStatusStore);
  const [saveError, setSaveError] = useState<string>();
  // The calendar day on this phone, not the UTC day of the timestamp.
  const lastBackup = status.lastBackupAt
    ? `Last backup: ${formatDate(formatLocalCalendarDate(new Date(status.lastBackupAt)))}`
    : "No backup recorded on this phone yet.";

  return (
    <View style={styles.group}>
      <AppText testID="backup-last-date" weight="bold">{lastBackup}</AppText>
      <AppText color="secondary" variant="caption">
        Remind me on the Dashboard when the portfolio has changed and no backup was saved
      </AppText>
      <View accessibilityLabel="Backup reminder" accessibilityRole="radiogroup">
        {backupReminderDayOptions.map((days) => {
          const selected = status.reminderDays === days;
          return (
            <Pressable
              accessibilityLabel={`Backup reminder ${optionLabel(days).toLowerCase()}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={days}
              onPress={() => {
                try {
                  setReminderDays(days);
                  setSaveError(undefined);
                } catch {
                  setSaveError("The reminder setting could not be saved. Try again.");
                }
              }}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              testID={`backup-reminder-${days}`}
            >
              <AppText style={styles.label}>{optionLabel(days)}</AppText>
              <Ionicons
                accessible={false}
                color={selected ? colors.primary : colors.text.secondary}
                name={selected ? "radio-button-on" : "radio-button-off"}
                size={24}
              />
            </Pressable>
          );
        })}
      </View>
      {saveError ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: colors.loss }} variant="caption">{saveError}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs, paddingTop: spacing.sm },
  label: { flex: 1 },
  option: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: interaction.minimumTouchTarget,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: interaction.pressedOpacity },
});
