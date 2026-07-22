import { StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  EmptyState,
  MaskedValue,
  MetricGroup,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  assetClassLabel,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { formatCompactINR, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, radii, spacing } from "@/src/theme";

import { useSellRedeemHolding } from "./useSellRedeemHolding";

type SellRedeemScreenProps = {
  assetId: string;
  now?: Date;
  onSaved?: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

function formatUnits(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "");
}

function quantityPlaceholder(availableUnits: number) {
  return availableUnits > 0 ? `Max ${formatUnits(availableUnits)}` : "0";
}

export function SellRedeemScreen({
  assetId,
  now = new Date(),
  onSaved,
  store = getPortfolioStore(),
}: SellRedeemScreenProps) {
  const flow = useSellRedeemHolding({ assetId, now, store });

  if (!flow.holding) {
    return (
      <ScreenContainer scroll testID="sell-redeem-screen">
        <View style={styles.content}>
          <ScreenHeader title="Sell / redeem" subtitle="Record exit • local only" />
          <EmptyState
            message="Open Holdings and choose an active position to sell or redeem."
            title="Holding not found"
          />
        </View>
      </ScreenContainer>
    );
  }

  const { holding } = flow;

  function save() {
    const result = flow.save();

    if (result.isValid) {
      onSaved?.();
    }
  }

  return (
    <ScreenContainer scroll testID="sell-redeem-screen">
      <View style={styles.content}>
        <ScreenHeader title="Sell / redeem" subtitle="Record exit • local only" />

        <PremiumCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.assetIcon}>
              <CategoryIcon assetClass={holding.asset.assetClass} size={24} />
            </View>
            <View style={styles.assetCopy}>
              <AppText variant="title" weight="bold">
                {holding.asset.name}
              </AppText>
              <AppText color="secondary">
                {holding.asset.symbol} • {assetClassLabel(holding.asset.assetClass)}
              </AppText>
            </View>
          </View>
          <MetricGroup
            metrics={[
              {
                label: "Available units",
                value: formatUnits(flow.availableUnits),
              },
              {
                label: "Current price",
                value: formatCompactINR(holding.currentPrice),
              },
              {
                label: "Current value",
                masked: false,
                value: formatCompactINR(holding.currentValue),
              },
            ]}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Exit details" />
          <AppText color="secondary" variant="caption">
            This reduces the holding and can add proceeds to deployable cash.
          </AppText>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <FormTextField
                error={flow.errors.quantity}
                keyboardType="decimal-pad"
                label="Quantity"
                onChangeText={flow.setQuantity}
                placeholder={quantityPlaceholder(flow.availableUnits)}
                testID="sell-redeem-quantity-input"
                value={flow.quantity}
              />
            </View>
            <View style={styles.formField}>
              <FormTextField
                error={flow.errors.sellPrice}
                keyboardType="decimal-pad"
                label="Sell price"
                onChangeText={flow.setSellPrice}
                placeholder="1700"
                testID="sell-redeem-price-input"
                value={flow.sellPrice}
              />
            </View>
          </View>
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <FormTextField
                error={flow.errors.fees}
                keyboardType="decimal-pad"
                label="Fees"
                onChangeText={flow.setFees}
                placeholder="0"
                testID="sell-redeem-fees-input"
                value={flow.fees}
              />
            </View>
            <View style={styles.formField}>
              <DatePickerField
                error={flow.errors.date}
                label="Date"
                maximumDate={now}
                onChange={flow.setDate}
                testID="sell-redeem-date-input"
                value={flow.date}
              />
            </View>
          </View>
          <FormTextField
            label="Notes"
            multiline
            onChangeText={flow.setNotes}
            placeholder="Optional note"
            value={flow.notes}
          />

          <View style={styles.previewPanel}>
            <SectionHeader title="Proceeds preview" />
          {flow.preview ? (
            <View style={styles.previewGrid}>
              <PreviewValue label="Gross proceeds" value={formatINR(flow.preview.grossProceeds)} />
              <PreviewValue label="Fees" value={formatINR(flow.preview.fees)} />
              <PreviewValue
                emphasized
                label="Net proceeds"
                value={formatINR(flow.preview.netProceeds)}
              />
              <PreviewValue
                label="Remaining units"
                value={formatUnits(flow.preview.remainingUnits)}
              />
              <PreviewValue
                label="Remaining value"
                value={formatINR(flow.preview.remainingValue)}
              />
            </View>
          ) : (
            <AppText color="secondary" variant="caption">
              Enter a valid quantity and sell price to preview proceeds.
            </AppText>
          )}
          </View>
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Cash proceeds" />
          <AppText color="secondary" variant="caption">
            Net proceeds are added to deployable cash automatically. Record a
            withdrawal separately if the money leaves the portfolio.
          </AppText>
          {flow.preview ? (
            <AppText testID="sell-redeem-cash-link-summary" weight="bold">
              {formatINR(flow.preview.netProceeds)} will be added to Cash Ledger
            </AppText>
          ) : null}
        </PremiumCard>

        {flow.errors.save ? (
          <AppText style={styles.errorText} variant="caption">
            {flow.errors.save}
          </AppText>
        ) : null}

        {flow.successMessage ? (
          <AppText style={styles.successText} weight="bold">
            {flow.successMessage}
          </AppText>
        ) : null}

        <AppButton
          accessibilityState={{ busy: flow.isSaving, disabled: !flow.canSave }}
          disabled={!flow.canSave}
          title={flow.isSaving ? "Saving..." : "Save sell / redeem"}
          testID="sell-redeem-save-button"
          onPress={save}
        />
      </View>
    </ScreenContainer>
  );
}

function PreviewValue({
  emphasized,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.previewValue}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <MaskedValue
        masked={false}
        value={value}
        variant={emphasized ? "title" : "body"}
        weight="bold"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  assetCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  assetIcon: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  content: {
    gap: spacing.cardGap,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  errorText: {
    color: colors.loss,
  },
  formField: {
    flex: 1,
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  previewPanel: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.card,
    gap: spacing.sm,
    padding: spacing.cardInner,
  },
  previewValue: {
    flexBasis: "45%",
    flexGrow: 1,
    gap: spacing.xs,
  },
  successText: {
    color: colors.profit,
  },
  summaryCard: {
    gap: spacing.md,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
});
