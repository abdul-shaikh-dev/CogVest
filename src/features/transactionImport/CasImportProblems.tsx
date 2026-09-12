import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton, AppText, PremiumCard, SectionHeader } from "@/src/components/common";
import { spacing } from "@/src/theme";

type Problem = { message: string; rowNumber?: number };

export function CasImportProblems({ problems }: { problems: Problem[] }) {
  const [expanded, setExpanded] = useState(false);
  if (problems.length === 0) return null;
  const groups = new Map<string, { count: number; rows: number[] }>();
  for (const problem of problems) {
    const group = groups.get(problem.message) ?? { count: 0, rows: [] };
    group.count += 1;
    if (problem.rowNumber !== undefined && !group.rows.includes(problem.rowNumber)) {
      group.rows.push(problem.rowNumber);
    }
    groups.set(problem.message, group);
  }
  return <PremiumCard style={styles.card} testID="cas-import-problems">
    <SectionHeader title="Statement needs attention" />
    <AppText>Some statement details could not be read or reconciled safely. Nothing has been imported.</AppText>
    <AppText color="secondary">Check that this is a detailed CAS with transaction history. Try another export, or use the details below to identify the affected entries. Do not remove transactions to bypass these checks.</AppText>
    <AppButton
      onPress={() => setExpanded(!expanded)}
      testID="cas-import-problems-toggle"
      title={expanded ? "Hide details" : `Show ${problems.length} ${problems.length === 1 ? "issue" : "issues"}`}
      variant="secondary"
    />
    {expanded ? <View style={styles.card} testID="cas-import-problems-details">
      {[...groups].map(([message, group]) => <View key={message}>
        <AppText>{message}{group.count > 1 ? ` (${group.count} occurrences)` : ""}</AppText>
        {group.rows.length > 0 ? <AppText color="secondary" variant="caption">Extracted {group.rows.length === 1 ? "row" : "rows"}: {group.rows.join(", ")}</AppText> : null}
      </View>)}
    </View> : null}
  </PremiumCard>;
}

const styles = StyleSheet.create({ card: { gap: spacing.md } });
