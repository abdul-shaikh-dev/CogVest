import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { AppText, BottomSheet, SectionHeader } from "@/src/components/common";
import { interaction, radii, spacing, createThemedStyles } from "@/src/theme";

export type SelectionOption<T extends string> = {
  label: string;
  value: T;
};

type SelectionFieldProps<T extends string> = {
  compact?: boolean;
  helperText?: string;
  helperTestID?: string;
  label: string;
  onChange: (value: T) => void;
  options: readonly SelectionOption<T>[];
  testIDPrefix: string;
  value: T;
};

export function SelectionField<T extends string>({
  compact = false,
  helperText,
  helperTestID,
  label,
  onChange,
  options,
  testIDPrefix,
  value,
}: SelectionFieldProps<T>) {
  const styles = useStyles();
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <>
      <Pressable
        accessibilityHint={`Select ${label.toLowerCase()}`}
        accessibilityLabel={label}
        accessibilityValue={{ text: selectedOption?.label ?? value }}
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.field,
          compact && styles.compactField,
          pressed && styles.pressed,
        ]}
        testID={`${testIDPrefix}-picker`}
      >
        <View style={[styles.copy, compact && styles.compactCopy]}>
          {!compact ? <AppText color="secondary" variant="caption">
            {label}
          </AppText> : null}
          <AppText weight="bold">{selectedOption?.label ?? value}</AppText>
          {helperText ? (
            <AppText
              color="secondary"
              testID={helperTestID}
              variant="caption"
            >
              {helperText}
            </AppText>
          ) : null}
        </View>
        <AppText color="secondary">›</AppText>
      </Pressable>

      <BottomSheet
        closeLabel={`Close ${label.toLowerCase()} options`}
        maxHeight="84%"
        onRequestClose={() => setIsOpen(false)}
        testID={`${testIDPrefix}-sheet`}
        visible={isOpen}
      >
        <SectionHeader title={`Choose ${label.toLowerCase()}`} />
        <View>
          {options.map((option, index) => {
            const selected = option.value === value;

            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  index < options.length - 1 && styles.divider,
                  pressed && styles.pressed,
                ]}
                testID={`${testIDPrefix}-${option.value}`}
              >
                <AppText
                  color={selected ? "primary" : "secondary"}
                  weight={selected ? "bold" : "medium"}
                >
                  {option.label}
                </AppText>
                {selected ? (
                  <AppText color="primary" variant="caption" weight="bold">
                    Selected
                  </AppText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  compactField: {
    alignSelf: "flex-start",
    flexShrink: 1,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  compactCopy: {
    flex: 0,
    flexShrink: 1,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  divider: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  field: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderColor: colors.border.strong,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: interaction.minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  option: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
}));
