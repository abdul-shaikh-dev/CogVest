import { useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";

import {
  AppText,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { formatINR } from "@/src/domain/formatters";
import { getPortfolioStore } from "@/src/store";
import { buildE2ePortfolioEvidence } from "@/src/testing/e2eEvidence";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";
import { spacing } from "@/src/theme";

export default function E2eEvidenceScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const store = getPortfolioStore();
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  );

  if (!canUseVisualQaHarness(params.token)) {
    return (
      <ScreenContainer testID="e2e-evidence-unavailable">
        <ScreenHeader subtitle="Unavailable" title="Test evidence" />
      </ScreenContainer>
    );
  }

  const evidence = buildE2ePortfolioEvidence(state);

  return (
    <ScreenContainer scroll testID="e2e-evidence-screen">
      <ScreenHeader
        subtitle="Read-only persisted state"
        title="E2E evidence"
      />
      <PremiumCard style={styles.card} testID="e2e-evidence-summary">
        <SectionHeader title="Record counts" />
        <EvidenceText testID="e2e-asset-count">
          Asset count: {evidence.assetCount}
        </EvidenceText>
        <EvidenceText testID="e2e-opening-position-count">
          Opening position count: {evidence.openingPositionCount}
        </EvidenceText>
        <EvidenceText testID="e2e-trade-count">
          Trade count: {evidence.tradeCount}
        </EvidenceText>
        <EvidenceText testID="e2e-duplicate-identity-count">
          Duplicate identity count: {evidence.duplicateIdentityCount}
        </EvidenceText>
      </PremiumCard>

      {evidence.assets.map(({ asset, holding, key, openingPositions, quote }) => (
        <PremiumCard
          key={asset.id}
          style={styles.card}
          testID={`e2e-asset-${key}`}
        >
          <SectionHeader title={asset.name} />
          <EvidenceText testID={`e2e-asset-${key}-identity`}>
            Identity: {asset.symbol} | {asset.ticker}
          </EvidenceText>
          <EvidenceText testID={`e2e-asset-${key}-classification`}>
            Classification: {asset.assetClass} | {asset.instrumentType ?? "unset"} | {asset.sectorType ?? "unset"}
          </EvidenceText>
          <EvidenceText testID={`e2e-asset-${key}-market`}>
            Market: {asset.currency} | {asset.exchange ?? "unset"} | {asset.quoteSourceId ?? "unset"}
          </EvidenceText>
          <EvidenceText testID={`e2e-asset-${key}-quote`}>
            Quote: {quote?.source ?? "missing"} | {quote ? formatINR(quote.price) : "missing"}
          </EvidenceText>
          <EvidenceText testID={`e2e-asset-${key}-position-count`}>
            Position count: {openingPositions.length}
          </EvidenceText>
          <EvidenceText testID={`e2e-asset-${key}-values`}>
            Values: invested {holding ? formatINR(holding.totalInvested) : "missing"} | current {holding ? formatINR(holding.currentValue) : "missing"} | quantity {holding?.totalUnits ?? 0}
          </EvidenceText>
          {openingPositions.map((position, index) => (
            <EvidenceText
              key={position.id}
              testID={`e2e-asset-${key}-position-${index}`}
            >
              Position {index + 1}: quantity {position.quantity} | average {formatINR(position.averageCostPrice)} | note {position.notes ?? "none"} | conviction {position.conviction ?? "none"}
            </EvidenceText>
          ))}
        </PremiumCard>
      ))}
    </ScreenContainer>
  );
}

function EvidenceText({
  children,
  testID,
}: {
  children: ReactNode;
  testID: string;
}) {
  return (
    <AppText selectable testID={testID} variant="caption">
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    marginBottom: spacing.cardGap,
  },
});
