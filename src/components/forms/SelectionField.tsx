import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText, SectionHeader } from "@/src/components/common";
import { colors, interaction, radii, spacing } from "@/src/theme";

export type SelectionOption<T extends string> = {
  label: string;
  value: T;
};

type SelectionFieldProps<T extends string> = {
  helperText?: string;
  helperTestID?: string;
  label: string;
  onChange: (value: T) => void;
  options: readonly SelectionOption<T>[];
  testIDPrefix: string;
  value: T;
};

export function SelectionField<T extends string>({
  helperText,
  helperTestID,
  label,
  onChange,
  options,
  testIDPrefix,
  value,
}: SelectionFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <>
      <Pressable
        accessibilityHint={`Select ${label.toLowerCase()}`}
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.field,
          pressed && styles.pressed,
        ]}
        testID={`${testIDPrefix}-picker`}
      >
        <View style={styles.copy}>
          <AppText color="secondary" variant="caption">
            {label}
          </AppText>
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

      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityLabel={`Close ${label.toLowerCase()} options`}
            accessibilityRole="button"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.sheet}>
            <SectionHeader title={`Choose ${label.toLowerCase()}`} />
            <ScrollView showsVerticalScrollIndicator={false}>
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.72)",
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.md,
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
    borderRadius: radii.button,
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
  sheet: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.sheet,
    maxHeight: "84%",
    padding: spacing.md,
  },
});
