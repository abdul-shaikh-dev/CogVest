import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState, type Ref } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { AppButton, AppText, DisclosureButton } from "@/src/components/common";
import { futuresEntryDate, futuresTimeZone, replaceFuturesTimePart } from "@/src/domain/futuresEntry";
import { colors, radii, spacing } from "@/src/theme";
import { FormTextField } from "./FormTextField";

type Props = { value: string; label: string; onChange: (value: string) => void; testID: string;
  error?: string; suggestedAt?: string; suggestedLabel?: string; now?: Date; fieldRef?: Ref<View> };

export function DateTimeField({ value, label, onChange, testID, error, suggestedAt, suggestedLabel = "Use event time", now = new Date(), fieldRef }: Props) {
  const [mode, setMode] = useState<"date" | "time">();
  const [exact, setExact] = useState(false);
  const selected = futuresEntryDate(value);
  function change(event: DateTimePickerEvent, next?: Date) {
    const part = mode;
    setMode(undefined);
    if (event.type === "set" && next && part) onChange(replaceFuturesTimePart(value, next, part, now));
  }
  return <View ref={fieldRef} style={styles.container} testID={`${testID}-field`}>
    <AppText color="secondary" variant="caption" weight="medium">{label}</AppText>
    <View style={styles.buttons}>
      {(["date", "time"] as const).map((part) => <Pressable key={part} accessibilityRole="button"
        accessibilityLabel={`Choose ${label} ${part}`} accessibilityState={{ expanded: mode === part }}
        onPress={() => { Keyboard.dismiss(); setMode(part); }} testID={`${testID}-${part}`}
        style={[styles.button, error && styles.invalid]}>
        <AppText>{selected ? part === "date" ? selected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : selected.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
          : `Choose ${part}`}</AppText>
      </Pressable>)}
    </View>
    <AppText color="secondary" variant="caption">Device time · {futuresTimeZone(selected ?? now)}</AppText>
    {suggestedAt && futuresEntryDate(suggestedAt) && value !== suggestedAt ? <AppButton title={suggestedLabel} variant="ghost"
      onPress={() => onChange(suggestedAt)} testID={`${testID}-use-time`} /> : null}
    <DisclosureButton expanded={exact} title="Exact timestamp"
      onPress={() => { Keyboard.dismiss(); setExact(!exact); }} testID={`${testID}-exact-toggle`} />
    {exact ? <FormTextField label={`${label} · exact timestamp with timezone`} value={value} onChangeText={onChange}
      error={error} testID={testID} />
      : error ? <AppText accessibilityRole="alert" style={styles.error} variant="caption">{error}</AppText> : null}
    {mode ? <DateTimePicker mode={mode} display={mode === "date" ? "calendar" : "clock"} value={selected ?? now}
      onChange={change} testID={`${testID}-picker`} is24Hour /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs }, buttons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  button: { minHeight: 48, justifyContent: "center", backgroundColor: colors.surface.elevated, borderRadius: radii.button, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  invalid: { borderWidth: 1, borderColor: colors.loss }, error: { color: colors.loss },
});
