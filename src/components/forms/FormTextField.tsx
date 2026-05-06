import type { KeyboardTypeOptions } from "react-native";
import { StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/src/components/common";
import { colors, radii, spacing } from "@/src/theme";

type FormTextFieldProps = {
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
  value: string;
};

export function FormTextField({
  error,
  keyboardType,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  testID,
  value,
}: FormTextFieldProps) {
  return (
    <View style={styles.container}>
      <AppText color="secondary" variant="caption" weight="medium">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        style={[styles.input, multiline && styles.multiline, error && styles.invalid]}
        testID={testID}
        value={value}
      />
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
  input: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.card,
    color: colors.text.primary,
    minHeight: 48,
    paddingHorizontal: spacing.cardInner,
    paddingVertical: spacing.sm,
  },
  invalid: {
    borderColor: colors.loss,
  },
  errorText: {
    color: colors.loss,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
});
