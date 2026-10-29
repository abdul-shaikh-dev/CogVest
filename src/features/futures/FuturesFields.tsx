import { createContext, useContext, useRef, useState, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View, type TextInput } from "react-native";

import { AppText, DisclosureButton } from "@/src/components/common";
import { DateTimeField, FormTextField } from "@/src/components/forms";
import { useTheme } from "@/src/theme";
import { useStyles } from "./futuresStyles";

export type EntryTarget = { layout: View | null; input?: TextInput | null };
export const EntryErrors = createContext<{ errors: Record<string, string>; refs: Record<string, EntryTarget>; clear: (id: string) => void }>({ errors: {}, refs: {}, clear: () => {} });
export function EntryField(props: ComponentProps<typeof FormTextField>) {
  const { errors, refs, clear } = useContext(EntryErrors);
  const target = useRef<EntryTarget>({ layout: null, input: null });
  return <View collapsable={false} ref={(node) => {
    target.current.layout = node;
    if (props.testID) refs[props.testID] = target.current;
  }}><FormTextField {...props} error={props.testID ? errors[props.testID] : undefined}
    inputRef={(node) => { target.current.input = node; }}
    onChangeText={(value) => { if (props.testID) clear(props.testID); props.onChangeText(value); }} /></View>;
}
export function TimeField(props: ComponentProps<typeof DateTimeField>) {
  const { errors, refs, clear } = useContext(EntryErrors);
  return <DateTimeField {...props} error={errors[props.testID]}
    fieldRef={(node) => { refs[props.testID] = { layout: node }; }}
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

export function Money({ value, masked, prominent = false }: { value: string; masked: boolean; prominent?: boolean }) {
  return <AppText variant={prominent ? "title" : "body"} weight="bold">{masked ? "••••" : value}</AppText>;
}

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
