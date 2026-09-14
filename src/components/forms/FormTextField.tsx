import type { Ref } from "react";
import type { KeyboardTypeOptions, ReturnKeyTypeOptions } from "react-native";
import { StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/src/components/common";
import { colors, radii, spacing } from "@/src/theme";

type FormTextFieldProps = {
  error?: string;
  inputRef?: Ref<TextInput>;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  returnKeyType?: ReturnKeyTypeOptions;
  secureTextEntry?: boolean;
  testID?: string;
  value: string;
};

export function FormTextField({
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
  returnKeyType,
  secureTextEntry = false,
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
        onBlur={onBlur}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.text.secondary}
        ref={inputRef}
        returnKeyType={returnKeyType}
        secureTextEntry={secureTextEntry}
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
    borderRadius: radii.button,
    color: colors.text.primary,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  invalid: {
    borderColor: colors.loss,
    borderWidth: 1,
  },
  errorText: {
    color: colors.loss,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: "top",
  },
});
