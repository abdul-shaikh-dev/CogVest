import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/src/components/common";
import {
  calendarDateToLocalDate,
  formatLocalCalendarDate,
} from "@/src/domain/dates";
import { colors, interaction, radii, spacing } from "@/src/theme";

type DatePickerFieldProps = {
  error?: string;
  label: string;
  maximumDate?: Date;
  onChange: (value: string) => void;
  testID: string;
  value: string;
};

function formatDisplayDate(value: string) {
  const date = calendarDateToLocalDate(value);

  if (!date) {
    return "Choose date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function DatePickerField({
  error,
  label,
  maximumDate = new Date(),
  onChange,
  testID,
  value,
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = calendarDateToLocalDate(value) ?? maximumDate;

  function handleChange(event: DateTimePickerEvent, nextDate?: Date) {
    setIsOpen(false);

    if (event.type === "set" && nextDate) {
      onChange(formatLocalCalendarDate(nextDate));
    }
  }

  return (
    <View style={styles.container}>
      <AppText color="secondary" variant="caption" weight="medium">
        {label}
      </AppText>
      <Pressable
        accessibilityLabel={`Choose ${label}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.field,
          error && styles.invalid,
          pressed && styles.pressed,
        ]}
        testID={testID}
      >
        <AppText color={value ? "primary" : "secondary"}>
          {formatDisplayDate(value)}
        </AppText>
        <AppText color="secondary" variant="caption">
          Calendar
        </AppText>
      </Pressable>
      {isOpen ? (
        <DateTimePicker
          display="calendar"
          maximumDate={maximumDate}
          mode="date"
          onChange={handleChange}
          testID={`${testID}-picker`}
          value={selectedDate}
        />
      ) : null}
      {error ? (
        <AppText selectable style={styles.errorText} variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  errorText: {
    color: colors.loss,
  },
  field: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  invalid: {
    borderColor: colors.loss,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
