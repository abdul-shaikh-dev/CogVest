import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  assetClassLabel,
  IconButton,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { formatINR } from "@/src/domain/formatters";
import type {
  AssetLookupResult,
  AssetLookupSearchResult,
} from "@/src/services/assetLookup";
import type { QuoteResult, ResolveQuoteInput } from "@/src/services/quotes";
import type {
  OpeningPositionCommandResult,
  PortfolioStoreState,
} from "@/src/store";
import { colors, spacing } from "@/src/theme";

import type { PickedHoldingsCsv } from "./useHoldingImport";
import { useHoldingImport } from "./useHoldingImport";

type HoldingImportScreenProps = {
  now?: () => Date;
  onCancel: () => void;
  onImported: (result: {
    items: OpeningPositionCommandResult[];
    pendingValuations: number;
  }) => void;
  pickCsvFile: () => Promise<PickedHoldingsCsv | undefined>;
  saveCsvTemplate?: () => Promise<string | undefined>;
  resolveQuote?: (input: ResolveQuoteInput) => Promise<QuoteResult>;
  searchAssetLookupResults?: (input: {
    query: string;
  }) => Promise<AssetLookupSearchResult>;
  store?: StoreApi<PortfolioStoreState>;
};

export function HoldingImportScreen(props: HoldingImportScreenProps) {
  const controller = useHoldingImport(props);
  const masked = controller.snapshot.preferences.maskWealthValues;
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<string>();

  async function saveTemplate() {
    if (isSavingTemplate || !props.saveCsvTemplate) return;
    setIsSavingTemplate(true);
    setTemplateStatus(undefined);
    try {
      const fileName = await props.saveCsvTemplate();
      if (fileName) {
        setTemplateStatus(
          `${fileName} saved. Replace the example rows, then choose the completed CSV.`,
        );
      }
    } catch {
      setTemplateStatus(
        "The template could not be saved. Choose another folder and try again.",
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }

  return (
    <ScreenContainer scroll testID="holding-import-screen">
      <ScreenHeader
        leading={
          <IconButton
            accessibilityLabel="Go back"
            icon="chevron-back"
            onPress={props.onCancel}
            testID="holding-import-back"
          />
        }
        subtitle="Versioned template • local only"
        title="Import holdings"
      />

      <PremiumCard style={styles.introCard}>
        <SectionHeader title="Start with the CogVest template" />
        <AppText color="secondary">
          Import aggregate opening positions, not transaction history. Review every
          resolved row before one atomic save.
        </AppText>
        <AppText color="secondary" variant="caption">
          Required: version, asset name or ticker, quantity, and average cost. Up to {controller.maxRows} rows.
        </AppText>
        <AppButton
          disabled={!props.saveCsvTemplate || isSavingTemplate || controller.isResolving || controller.isSaving}
          onPress={saveTemplate}
          testID="save-holdings-csv-template"
          title={isSavingTemplate ? "Saving template..." : "Save CSV template"}
          variant="secondary"
        />
        {templateStatus ? (
          <AppText color="secondary" testID="holdings-csv-template-status" variant="caption">
            {templateStatus}
          </AppText>
        ) : null}
        <AppButton
          disabled={controller.isResolving || controller.isSaving}
          onPress={controller.selectFile}
          testID="select-holdings-csv"
          title={controller.fileName ? "Choose another CSV" : "Choose CSV"}
        />
      </PremiumCard>

      {controller.fileName ? (
        <AppText color="secondary" variant="caption">
          Selected: {controller.fileName}
        </AppText>
      ) : null}
      {controller.isResolving ? (
        <PremiumCard testID="holding-import-resolving">
          <AppText weight="bold">Matching assets and checking prices...</AppText>
          <AppText color="secondary" variant="caption">
            No portfolio data is changed during this review.
          </AppText>
        </PremiumCard>
      ) : null}
      {controller.screenError ? (
        <PremiumCard testID="holding-import-screen-error">
          <AppText style={styles.errorText} weight="bold">
            {controller.screenError}
          </AppText>
        </PremiumCard>
      ) : null}
      {controller.parseErrors.map((error, index) => (
        <PremiumCard key={`${error.code}-${error.rowNumber ?? index}`}>
          <AppText style={styles.errorText} weight="bold">
            {error.rowNumber ? `Row ${error.rowNumber}: ` : ""}{error.message}
          </AppText>
        </PremiumCard>
      ))}

      {controller.resolutions.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Resolve holdings" />
          {controller.resolutions.map((resolution) => {
            const rowError = controller.plan.errors.find(
              (error) => error.rowNumber === resolution.row.rowNumber,
            );
            const existingPositions = resolution.asset
              ? controller.snapshot.openingPositions.filter(
                  (position) => position.assetId === resolution.asset?.id,
                )
              : [];
            const needsUpdate =
              existingPositions.length === 1 && !resolution.allowExistingUpdate;

            return (
              <PremiumCard
                key={resolution.row.rowNumber}
                testID={`holding-import-row-${resolution.row.rowNumber}`}
              >
                <View style={styles.rowHeader}>
                  <View style={styles.rowCopy}>
                    <AppText weight="bold">{resolution.row.name}</AppText>
                    <AppText color="secondary" variant="caption">
                      Row {resolution.row.rowNumber} • {resolution.row.quantity} {resolution.row.quantity === 1 ? "unit" : "units"}
                    </AppText>
                    <AppText
                      color="secondary"
                      variant="caption"
                    >
                      {formatINR(resolution.row.averageCost)} average
                    </AppText>
                  </View>
                  <AppText color={resolution.status === "ready" ? "primary" : "secondary"} variant="caption" weight="bold">
                    {resolution.status === "ready" ? "Ready" : "Review"}
                  </AppText>
                </View>

                {resolution.asset ? (
                  <AppText color="secondary" variant="caption">
                    {resolution.asset.name} • {resolution.asset.ticker} • {assetClassLabel(resolution.asset.assetClass)} • {resolution.asset.currency}
                  </AppText>
                ) : null}
                {resolution.row.currentPrice !== undefined ? (
                  <AppText
                    color="secondary"
                    variant="caption"
                  >
                    Current price {formatINR(resolution.row.currentPrice)} • Manual • as of {resolution.row.valuationAsOf}
                  </AppText>
                ) : resolution.quote ? (
                  <AppText
                    color="secondary"
                    variant="caption"
                  >
                    Current price {formatINR(resolution.quote.price)} • {resolution.quote.source}
                  </AppText>
                ) : resolution.status === "ready" ? (
                  <AppText color="secondary" variant="caption">
                    Valuation pending after import
                  </AppText>
                ) : null}
                {resolution.quoteFailure ? (
                  <AppText color="secondary" variant="caption">
                    Live price unavailable. This row can still import as valuation pending.
                  </AppText>
                ) : null}

                {resolution.status === "selectionRequired" ? (
                  <View style={styles.actions}>
                    <AppText color="secondary" variant="caption">
                      Select the matching provider asset:
                    </AppText>
                    {resolution.candidates.slice(0, 4).map((candidate) => (
                      <AppButton
                        key={`${candidate.provider}:${candidate.quoteSourceId}`}
                        disabled={controller.isResolving}
                        onPress={() =>
                          controller.selectCandidate(
                            resolution.row.rowNumber,
                            candidate as AssetLookupResult,
                          )
                        }
                        testID={`holding-import-row-${resolution.row.rowNumber}-candidate-${candidate.id}`}
                        title={`${candidate.name} • ${candidate.ticker}`}
                        variant="secondary"
                      />
                    ))}
                  </View>
                ) : null}
                {resolution.status === "manualRequired" ? (
                  <AppButton
                    onPress={() =>
                      controller.useManualAsset(resolution.row.rowNumber)
                    }
                    testID={`holding-import-row-${resolution.row.rowNumber}-manual`}
                    title="Use CSV details as manual asset"
                    variant="secondary"
                  />
                ) : null}
                {needsUpdate ? (
                  <AppButton
                    onPress={() =>
                      controller.allowExistingUpdate(resolution.row.rowNumber)
                    }
                    testID={`holding-import-row-${resolution.row.rowNumber}-update`}
                    title="Replace existing opening position"
                    variant="secondary"
                  />
                ) : null}
                {resolution.lookupFailure ? (
                  <AppText color="secondary" variant="caption">
                    {resolution.lookupFailure}
                  </AppText>
                ) : null}
                {rowError ? (
                  <AppText style={styles.errorText} variant="caption" weight="bold">
                    {rowError.message}
                  </AppText>
                ) : null}
              </PremiumCard>
            );
          })}
        </View>
      ) : null}

      {controller.plan.summary ? (
        <PremiumCard elevated testID="holding-import-summary">
          <SectionHeader title="Portfolio after import" />
          <View style={styles.summaryGrid}>
            <Summary label="Invested" masked={masked} value={formatINR(controller.plan.summary.resultingInvested)} />
            <Summary
              label="Current"
              masked={
                masked && controller.plan.summary.resultingCurrentValue !== null
              }
              value={controller.plan.summary.resultingCurrentValue === null
                ? "Pending"
                : formatINR(controller.plan.summary.resultingCurrentValue)}
            />
            <Summary label="Additions" value={`${controller.plan.summary.additions}`} />
            <Summary label="Updates" value={`${controller.plan.summary.updates}`} />
            <Summary label="Rows ready" value={`${controller.resolutions.length}`} />
            <Summary label="Skipped" value="0" />
          </View>
          {controller.plan.summary.pendingValuations > 0 ? (
            <AppText color="secondary" variant="caption">
              {controller.plan.summary.pendingValuations} holding valuation{controller.plan.summary.pendingValuations === 1 ? " is" : "s are"} still pending.
            </AppText>
          ) : null}
          <AppButton
            disabled={controller.isSaving}
            onPress={controller.confirmImport}
            testID="confirm-holdings-import"
            title={controller.isSaving ? "Importing..." : "Import all holdings"}
          />
        </PremiumCard>
      ) : null}
    </ScreenContainer>
  );
}

function Summary({
  label,
  masked = false,
  value,
}: {
  label: string;
  masked?: boolean;
  value: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <AppText color="secondary" variant="caption">{label}</AppText>
      <MaskedValue masked={masked} value={value} weight="bold" />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  errorText: { color: colors.loss },
  introCard: { gap: spacing.md, marginBottom: spacing.md },
  rowCopy: { flex: 1 },
  rowHeader: { flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  section: { gap: spacing.cardGap },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  summaryItem: { minWidth: "42%" },
});
