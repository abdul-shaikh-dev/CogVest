import { Ionicons } from "@expo/vector-icons";
import { Pressable, TextInput, useWindowDimensions, View } from "react-native";

import { AppButton, AppText, CategoryIcon, EmptyState } from "@/src/components/common";
import { useTheme } from "@/src/theme";

import { FilterRow } from "./HoldingsFilters";
import type { HoldingFilter } from "./holdingsReview";
import { useStyles } from "./holdingsStyles";
import { getFilterCounts, getFilterLabel, getQuoteStatus } from "./holdingsViewModel";

export function HoldingsSearchField({
  onChange,
  value,
}: {
  onChange: (query: string) => void;
  value: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.searchField}>
      <Ionicons
        accessible={false}
        name="search-outline"
        size={20}
        color={colors.text.secondary}
      />
      <TextInput
        accessibilityLabel="Search holdings"
        onChangeText={onChange}
        placeholder="Find a holding"
        placeholderTextColor={colors.text.secondary}
        style={styles.searchInput}
        testID="holdings-search-input"
        value={value}
      />
    </View>
  );
}

export function ResumeSetupRow({
  onResume,
  savedCount,
}: {
  onResume: () => void;
  savedCount: number;
}) {
  const styles = useStyles();

  return (
    <View style={styles.resumeRow} testID="holdings-continue-setup">
      <View style={styles.flex}>
        <AppText weight="bold">Resume setup</AppText>
        <AppText color="secondary" variant="caption">
          {savedCount} saved locally.
        </AppText>
      </View>
      <AppButton
        onPress={onResume}
        testID="holdings-continue-setup-button"
        title="Resume"
        variant="secondary"
      />
    </View>
  );
}

export function QuoteHealthRow({
  onShowDetails,
  quoteStatus,
}: {
  onShowDetails: () => void;
  quoteStatus: ReturnType<typeof getQuoteStatus>;
}) {
  const styles = useStyles();

  return (
    <View
      accessibilityLiveRegion={quoteStatus.prominent ? "polite" : "none"}
      style={[
        styles.quoteStatus,
        quoteStatus.prominent && styles.quoteStatusProminent,
      ]}
      testID="holdings-quote-health"
    >
      <CategoryIcon assetClass="neutral" size={18} />
      <View style={styles.quoteStatusCopy}>
        <AppText
          style={quoteStatus.prominent ? styles.warningText : undefined}
          variant="caption"
          weight="bold"
        >
          {quoteStatus.title}
        </AppText>
      </View>
      <AppButton
        onPress={onShowDetails}
        style={styles.quoteDetailsAction}
        title="Details"
        variant="ghost"
      />
    </View>
  );
}

export function PendingValuationsRow({
  count,
  onRefresh,
}: {
  count: number;
  onRefresh: () => void;
}) {
  const styles = useStyles();
  const { width, fontScale } = useWindowDimensions();

  return (
    <View
      style={[styles.pendingValuationRow, (width < 400 || fontScale > 1.15) && styles.stackedContent]}
      testID="holdings-pending-valuations"
    >
      <View style={styles.pendingValuationCopy}>
        <AppText weight="bold">
          {count} valuation
          {count === 1 ? "" : "s"} pending
        </AppText>
        <AppText color="secondary" variant="caption">
          Invested values remain available. Current totals and allocation
          are incomplete.
        </AppText>
      </View>
      <AppButton
        title="Refresh prices"
        testID="holdings-refresh-pending-prices"
        onPress={onRefresh}
      />
    </View>
  );
}

export function NoHoldingsState({
  onAddTrade,
  onOpenAddPanel,
  onQuickSetup,
  savedCount,
}: {
  onAddTrade?: () => void;
  onOpenAddPanel: () => void;
  onQuickSetup?: () => void;
  savedCount: number;
}) {
  return (
    <EmptyState
      actionLabel={
        onQuickSetup
          ? savedCount > 0
            ? "Continue portfolio setup"
            : "Set up your portfolio"
          : onAddTrade
            ? "Add Holding"
            : undefined
      }
      actionTestID={
        onQuickSetup ? "quick-setup-button" : "add-trade-button"
      }
      message={
        savedCount > 0
          ? `${savedCount} confirmed ${savedCount === 1 ? "holding is" : "holdings are"} saved locally.`
          : onQuickSetup
            ? "Choose manual entry or import holdings and transaction history."
            : "Holdings are created automatically from your portfolio entries."
      }
      title="No holdings yet"
      onAction={onQuickSetup ? onOpenAddPanel : onAddTrade}
      onSecondaryAction={onQuickSetup ? onAddTrade : undefined}
      secondaryActionLabel={onQuickSetup ? "Add one holding" : undefined}
      secondaryActionTestID="add-trade-button"
    />
  );
}

/** The market list's heading, filter toggle, insights link and filter chips. */
export function MarketListControls({
  allocationAvailable,
  filter,
  filterCounts,
  filtersVisible,
  minimal,
  onOpenInsights,
  onSelectFilter,
  onToggleFilters,
}: {
  allocationAvailable: boolean;
  filter: HoldingFilter;
  filterCounts: ReturnType<typeof getFilterCounts>;
  filtersVisible: boolean;
  minimal: boolean;
  onOpenInsights: () => void;
  onSelectFilter: (filter: HoldingFilter) => void;
  onToggleFilters: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <>
      <View style={styles.listHeading}>
        <AppText
          color="secondary"
          testID="holdings-allocation-scope"
          variant="caption"
        >
          Value order · Weight excludes cash and PPF
        </AppText>
        <View style={styles.listActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${filtersVisible ? "Hide" : "Show"} holding filters. Current filter: ${getFilterLabel(filter)}`}
            accessibilityState={{ expanded: filtersVisible }}
            onPress={onToggleFilters}
            style={styles.listAction}
            testID="holdings-filter-toggle"
          >
            <Ionicons
              accessible={false}
              name="options-outline"
              size={18}
              color={colors.text.primary}
            />
            <AppText variant="caption" weight="bold">
              {filter === "all" ? "Filter" : getFilterLabel(filter)}
            </AppText>
          </Pressable>
          {!minimal ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Portfolio insights"
              onPress={onOpenInsights}
              style={styles.listAction}
              testID="holdings-insights-button"
            >
              <AppText variant="caption">Portfolio insights</AppText>
              <Ionicons
                accessible={false}
                name="chevron-forward"
                size={16}
                color={colors.text.primary}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {filtersVisible ? (
        <FilterRow
          allocationAvailable={allocationAvailable}
          counts={filterCounts}
          onSelect={(next) => {
            if (next !== "high-allocation" || allocationAvailable) {
              onSelectFilter(next);
            }
          }}
          selected={filter}
        />
      ) : null}
    </>
  );
}
