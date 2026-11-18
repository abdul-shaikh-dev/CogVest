import type { Ref } from "react";
import type { KeyboardTypeOptions, ReturnKeyTypeOptions, TextInputInstance } from "react-native";
import { StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/src/components/common";
import { radii, spacing, useTheme, createThemedStyles } from "@/src/theme";

type FormTextFieldProps = {
  /** Spoken after the label, for example the currency a prefix shows. */
  accessibilityLabelSuffix?: string;
  error?: string;
  inputRef?: Ref<TextInputInstance>;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  /** Shown inside the field before the value, for example a currency symbol. */
  prefix?: string;
  returnKeyType?: ReturnKeyTypeOptions;
  secureTextEntry?: boolean;
  testID?: string;
  value: string;
};

/**
 * The spoken name of a field: its label, then anything the prefix shows, then
 * the current error, so TalkBack reads the error with the field (#669).
 */
export function fieldAccessibilityLabel(label: string, suffix?: string, error?: string) {
  return [label, suffix, error ? `Error: ${error}` : undefined].filter(Boolean).join(", ");
}

export function FormTextField({
  accessibilityLabelSuffix,
  error,
  inputRef,
  keyboardType,
  label,
  multiline = false,
  onChangeText,
  onBlur,
  onFocus,
  onSubmitEditing,
  placeholder,
  prefix,
  returnKeyType,
  secureTextEntry = false,
  testID,
  value,
}: FormTextFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <AppText color="secondary" variant="caption" weight="medium">
        {label}
      </AppText>
      <View style={[styles.field, multiline && styles.multiline, error && styles.invalid]}>
        {prefix ? (
          <AppText
            accessible={false}
            color="secondary"
            importantForAccessibility="no"
            style={styles.prefix}
            testID={testID ? `${testID}-prefix` : undefined}
            weight="medium"
          >
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          accessibilityLabel={fieldAccessibilityLabel(label, accessibilityLabelSuffix, error)}
          keyboardType={keyboardType}
          multiline={multiline}
          onBlur={onBlur}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.text.secondary}
          ref={inputRef}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          style={[styles.input, multiline && styles.multilineInput]}
          testID={testID}
          value={value}
        />
      </View>
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          selectable
          style={styles.errorText}
          testID={testID ? `${testID}-error` : undefined}
          variant="caption"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  // A 1dp outline keeps the field's edge visible on every surface (#669).
  field: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderColor: colors.border.strong,
    borderRadius: radii.button,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.text.primary,
    flex: 1,
    // The input is the tap target, so it meets the 48 dp minimum itself (#719).
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 6,
  },
  invalid: {
    borderColor: colors.loss,
  },
  errorText: {
    color: colors.loss,
  },
  multiline: {
    alignItems: "flex-start",
    minHeight: 88,
  },
  multilineInput: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  prefix: {
    marginRight: spacing.xs,
  },
}));
