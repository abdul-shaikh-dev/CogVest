import { createContext, Fragment, useContext, useRef, useState, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, type TextInputInstance, View, type ViewInstance } from "react-native";

import { AppText, DisclosureButton, MASKED_AMOUNT, MASKED_INR_VALUE, MASKED_VALUE_ACCESSIBILITY_LABEL, MaskedValue } from "@/src/components/common";
import { DateTimeField, FormTextField } from "@/src/components/forms";
import { useTheme } from "@/src/theme";
import { useStyles } from "./futuresStyles";

export type EntryTarget = { layout: ViewInstance | null; input?: TextInputInstance | null };
export const EntryErrors = createContext<{ errors: Record<string, string>; register: (id: string, target: EntryTarget) => void; clear: (id: string) => void }>({ errors: {}, register: () => {}, clear: () => {} });
export function EntryField(props: ComponentProps<typeof FormTextField>) {
  const { errors, register, clear } = useContext(EntryErrors);
  const target = useRef<EntryTarget>({ layout: null, input: null });
  return <View collapsable={false} ref={(node) => {
    target.current.layout = node;
    if (props.testID) register(props.testID, target.current);
  }}><FormTextField {...props} error={props.testID ? errors[props.testID] : undefined}
    inputRef={(node) => { target.current.input = node; }}
    onChangeText={(value) => { if (props.testID) clear(props.testID); props.onChangeText(value); }} /></View>;
}
export function TimeField(props: ComponentProps<typeof DateTimeField>) {
  const { errors, register, clear } = useContext(EntryErrors);
  return <DateTimeField {...props} error={errors[props.testID]}
    fieldRef={(node) => { register(props.testID, { layout: node }); }}
    onChange={(value) => { clear(props.testID); props.onChange(value); }} />;
}

export function Choice({ label, selected, onPress, testID, checkbox = false }: { label: string; selected: boolean; onPress: () => void; testID?: string; checkbox?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <Pressable accessibilityRole={checkbox ? "checkbox" : "radio"} accessibilityLabel={label} accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, checkbox && styles.checkbox, selected && styles.selected]} testID={testID}>
    {checkbox ? <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.primary : colors.text.secondary} accessible={false} /> : null}
    <AppText weight={selected ? "bold" : "regular"} style={checkbox ? styles.choiceLabel : undefined}>{label}</AppText>
  </Pressable>;
}

/** A masked Futures amount keeps its currency visible: ₹•••• or •••• USDT. */
function maskedTextFor(value: string) {
  if (value.startsWith("₹")) return MASKED_INR_VALUE;
  return value.endsWith(" USDT") ? `${MASKED_AMOUNT} USDT` : MASKED_AMOUNT;
}

export function Money({ value, masked, prominent = false }: { value: string; masked: boolean; prominent?: boolean }) {
  return <MaskedValue masked={masked} maskedText={maskedTextFor(value)} value={value} variant={prominent ? "title" : "body"} weight="bold" />;
}

/** Labelled amounts on one wrapping line, each masked on its own: "Fees 1 USDT · Funding 2 USDT". */
export function AmountLine({ color, masked, parts, testID }: {
  color?: "primary" | "secondary";
  masked: boolean;
  parts: readonly { label?: string; value: string }[];
  testID?: string;
}) {
  // One element for TalkBack (and Maestro): "Qty 1 · Entry Amount hidden".
  const label = parts
    .map((part) => [part.label, masked ? MASKED_VALUE_ACCESSIBILITY_LABEL : part.value].filter(Boolean).join(" "))
    .join(" · ");
  return <View accessibilityLabel={label} accessible style={amountLineStyles.line} testID={testID}>
    {parts.map((part, index) => <Fragment key={index}>
      {index > 0 ? <AppText color={color}> · </AppText> : null}
      {part.label ? <AppText color={color}>{part.label} </AppText> : null}
      <MaskedValue color={color} masked={masked} maskedText={maskedTextFor(part.value)} value={part.value} />
    </Fragment>)}
  </View>;
}

const amountLineStyles = StyleSheet.create({
  line: { flexDirection: "row", flexWrap: "wrap" },
});

export function displayTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** One visible sentence, with the rest of the explanation behind a disclosure. */
export function Explainer({ summary, details, testID }: { summary: string; details: string; testID: string }) {
  const [expanded, setExpanded] = useState(false);
  return <>
    <AppText color="secondary">{summary}</AppText>
    <DisclosureButton expanded={expanded} title="Details" onPress={() => setExpanded(!expanded)} testID={`${testID}-toggle`} />
    {expanded ? <AppText color="secondary" testID={testID}>{details}</AppText> : null}
  </>;
}
