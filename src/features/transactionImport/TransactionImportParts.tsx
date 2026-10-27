import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { AppButton, AppText, PremiumCard } from "@/src/components/common";
import { useTheme } from "@/src/theme";
import type { Asset } from "@/src/types";

import type { ResolutionGroup } from "./transactionImportResolution";
import { useStyles } from "./transactionImportStyles";
import {
  candidateTestID,
  candidateTitle,
  holdingMatchCountText,
  holdingMatchDetail,
} from "./transactionImportViewModel";

export function HoldingMatch({ group, onSelect }: {
  group: ResolutionGroup;
  onSelect: (key: string, asset: Asset) => void;
}) {
  const styles = useStyles();
  const [changing, setChanging] = useState(false);
  const chosen = group.selectedAsset ?? group.suggestedAsset;
  return <View style={styles.holdingPreview} testID={`transaction-import-asset-${group.key}`}>
    <AppText weight="bold">{chosen?.name ?? group.title}</AppText>
    {chosen ? (
      <AppText color="secondary" variant="caption">{holdingMatchDetail(group, chosen)}</AppText>
    ) : null}
    <AppText color="secondary" variant="caption">{holdingMatchCountText(group, chosen)}</AppText>
    {!chosen && group.casClassificationRequired ? (
      <AppText color="secondary">
        Fund identity is verified from the statement. Choose how it should appear in your portfolio allocation; this applies to every transaction for this fund.
      </AppText>
    ) : null}
    {chosen && group.candidates.length > 0 ? (
      <AppButton
        onPress={() => setChanging(!changing)}
        testID={`transaction-import-change-${group.key}`}
        title={changing ? "Keep this match" : "Change match"}
        variant="secondary"
      />
    ) : null}
    {!chosen && group.candidates.length === 0 ? (
      <AppText color="secondary">
        No matching listing was found. This holding needs a verified asset match before its history can be imported.
      </AppText>
    ) : null}
    {!chosen || changing ? <View style={styles.actions}>
      {group.candidates.map((candidate) => (
        <AppButton
          key={`${candidate.id}:${candidate.assetClass}`}
          onPress={() => { onSelect(group.key, candidate); setChanging(false); }}
          testID={candidateTestID(group, candidate)}
          title={candidateTitle(group, candidate)}
          variant="secondary"
        />
      ))}
    </View> : null}
  </View>;
}

type ChoiceProps = {
  active: boolean;
  description: string;
  onPress: () => void;
  testID: string;
  title: string;
};

export function ModeButton({ active, description, onPress, testID, title }: ChoiceProps) {
  const styles = useStyles();
  return <Pressable
    accessibilityRole="radio"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={[styles.modeButton, active && styles.modeButtonActive]}
    testID={testID}
  >
    <AppText weight="bold">{title}</AppText>
    <AppText color="secondary" variant="caption">{description}</AppText>
  </Pressable>;
}

export function SourceAction({ description, onPress, testID, title }: Omit<ChoiceProps, "active">) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}
    testID={testID}
  >
    <View style={styles.sourceCopy}>
      <AppText weight="bold">{title}</AppText>
      <AppText color="secondary" variant="caption">{description}</AppText>
    </View>
    <Ionicons
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      name="chevron-forward"
      size={20}
      color={colors.text.secondary}
    />
  </Pressable>;
}

export function SourceChoice({ active, description, onPress, testID, title }: ChoiceProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={title}
    accessibilityHint={description}
    accessibilityState={{ checked: active }}
    onPress={onPress}
    style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}
    testID={testID}
  >
    <Ionicons
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      name={active ? "radio-button-on" : "radio-button-off"}
      size={24}
      color={active ? colors.primary : colors.text.secondary}
    />
    <View style={styles.sourceCopy}>
      <AppText weight="bold">{title}</AppText>
      <AppText color="secondary" variant="caption">{description}</AppText>
    </View>
  </Pressable>;
}

export function Summary({
  attention = false,
  prominent = false,
  label,
  testID,
  value,
}: {
  attention?: boolean;
  prominent?: boolean;
  label: string;
  testID: string;
  value: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.summary}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <AppText
        style={[styles.summaryValue, attention && styles.error]}
        variant={prominent ? "title" : "body"}
        testID={testID}
        weight="bold"
      >
        {value}
      </AppText>
    </View>
  );
}

export function ReviewDisclosure({ expanded, onPress, testID, title }: {
  expanded: boolean;
  onPress: () => void;
  testID: string;
  title: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ expanded }}
    onPress={onPress}
    style={({ pressed }) => [styles.helpRow, pressed && styles.pressed]}
    testID={testID}
  >
    <AppText style={styles.sourceCopy} weight="bold">{title}</AppText>
    <Ionicons
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      name={expanded ? "chevron-up" : "chevron-down"}
      size={20}
      color={colors.text.secondary}
    />
  </Pressable>;
}

export function ErrorCard({ message, testID }: { message: string; testID?: string }) {
  const styles = useStyles();
  return <PremiumCard testID={testID}>
    <AppText style={styles.error} weight="bold">{message}</AppText>
  </PremiumCard>;
}

export function InlineError({ message, testID }: { message: string; testID?: string }) {
  const styles = useStyles();
  return <View style={styles.inlineError} testID={testID}>
    <AppText accessibilityLiveRegion="polite" style={styles.error} weight="bold">{message}</AppText>
  </View>;
}
