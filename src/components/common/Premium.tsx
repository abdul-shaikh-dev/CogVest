import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import Animated from "react-native-reanimated";
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { radii, spacing, useTheme, createThemedStyles, type ThemeColors } from "@/src/theme";
import type { AssetClass } from "@/src/types";

import { AppText } from "./AppText";
import { MaskedValue } from "./MaskedValue";
import { ExpressiveLoader, usePressFeedback } from "./Motion";
import {
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "./pressableStyles";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PremiumCardProps = {
  children: ReactNode;
  elevated?: boolean;
  /** Open layout for routine content; cards remain the default for decisions and alerts. */
  section?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type ScreenHeaderProps = {
  compact?: boolean;
  action?: ReactNode;
  leading?: ReactNode;
  subtitle?: string;
  title: string;
};

type Metric = {
  color?: "primary" | "secondary";
  exactValue?: string;
  label: string;
  masked?: boolean;
  value: string;
};

type MetricGroupProps = {
  metrics: Metric[];
  testID?: string;
};

type GroupedListRowProps = {
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  meta?: string;
  onPress?: () => void;
  testID?: string;
  title: string;
  value?: string;
  selected?: boolean;
  showChevron?: boolean;
};

export type AdaptiveLayoutMode = "accessibility" | "large" | "standard";

export function getAdaptiveLayoutMode(fontScale: number): AdaptiveLayoutMode {
  // Android can report configured font scales a few hundredths below the
  // displayed setting, so leave a small tolerance around system presets.
  if (fontScale >= 1.45) return "accessibility";
  if (fontScale >= 1.25) return "large";
  return "standard";
}

export function getMetricColumnCount(fontScale: number) {
  const mode = getAdaptiveLayoutMode(fontScale);

  if (mode === "accessibility") return 1;
  if (mode === "large") return 2;
  return 4;
}

const getAssetClassConfig = (colors: ThemeColors): Record<
  AssetClass | "neutral",
  { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> => ({
  cash: { color: colors.cashBlue, icon: "wallet-outline", label: "Cash" },
  crypto: { color: colors.cryptoAmber, icon: "logo-bitcoin", label: "Crypto" },
  debt: { color: colors.blue, icon: "shield-outline", label: "Debt" },
  etf: { color: colors.primary, icon: "trending-up-outline", label: "Equity" },
  neutral: { color: colors.text.secondary, icon: "analytics-outline", label: "Info" },
  stock: { color: colors.primary, icon: "trending-up-outline", label: "Equity" },
});

export function PremiumCard({
  children,
  elevated = false,
  section = false,
  style,
  testID,
}: PremiumCardProps) {
  const styles = useStyles();
  return (
    <View
      style={[styles.card, elevated && styles.elevatedCard, section && styles.openSection, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

export function ScreenHeader({
  compact = false,
  action,
  leading,
  subtitle,
  title,
}: ScreenHeaderProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const shouldStack = getAdaptiveLayoutMode(fontScale) !== "standard";

  return (
    <View style={[styles.header, compact && styles.headerCompact, shouldStack && styles.headerStacked]}>
      <View style={[styles.headerIdentity, shouldStack && styles.headerIdentityStacked]}>
        {leading ? <View style={styles.headerLeading}>{leading}</View> : null}
        <View style={styles.headerCopy}>
          <AppText accessibilityRole="header" variant="largeTitle" style={compact && styles.compactTitle} weight="bold">
            {title}
          </AppText>
          {subtitle ? <AppText color="secondary" variant={compact ? "caption" : "body"}>{subtitle}</AppText> : null}
        </View>
      </View>
      {action ? (
        <View
          style={[
            styles.headerAction,
            shouldStack && styles.headerActionStacked,
          ]}
        >
          {action}
        </View>
      ) : null}
    </View>
  );
}

export function IconButton({
  plain = false,
  prominent = false,
  accessibilityLabel,
  busy = false,
  disabled = false,
  icon,
  onPress,
  testID,
}: {
  plain?: boolean;
  /**
   * The screen's main header action (#785): a round filled container, apart
   * from plain icons and the rounded-square Back button. Neutral, not green.
   */
  prominent?: boolean;
  accessibilityLabel: string;
  /** Work is running: the button is announced as busy and ignores taps (#670). */
  busy?: boolean;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  // An unavailable icon action fades further than a disabled text button.
  const press = usePressFeedback(disabled, 0.4);
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled || busy}
      android_ripple={androidRipple(colors.ripple)}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.iconButton,
        plain && styles.iconButtonPlain,
        prominent && styles.iconButtonProminent,
        minimumTouchTargetStyle,
        press.style,
      ]}
      testID={testID}
    >
      {busy ? (
        // Prices loading (#785): the indicator stands in for the icon.
        <ExpressiveLoader color={colors.text.secondary} testID={testID ? `${testID}-loader` : undefined} />
      ) : (
        <Ionicons
          accessible={false}
          color={colors.text.primary}
          name={icon}
          size={20}
        />
      )}
    </AnimatedPressable>
  );
}

export function HeroMetric({
  label,
  masked,
  subValue,
  subValueTone = "positive",
  value,
}: {
  label: string;
  masked?: boolean;
  subValue?: string;
  subValueTone?: "positive" | "negative" | "secondary";
  value: string;
}) {
  const styles = useStyles();
  const toneStyle =
    subValueTone === "positive"
      ? styles.positiveText
      : subValueTone === "negative"
        ? styles.negativeText
        : styles.secondaryText;

  return (
    <PremiumCard section style={styles.heroCard}>
      <AppText color="secondary">{label}</AppText>
      <MaskedValue masked={masked} value={value} variant="hero" weight="bold" />
      {subValue ? (
        <View>
          <AppText style={toneStyle} variant="caption" weight="bold">
            {subValue}
          </AppText>
        </View>
      ) : null}
    </PremiumCard>
  );
}

export function MetricGroup({ metrics, testID }: MetricGroupProps) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const columns = getMetricColumnCount(fontScale);
  const adaptiveCellStyle =
    columns === 1
      ? styles.metricCellFull
      : columns === 2
        ? styles.metricCellHalf
        : undefined;

  return (
    <PremiumCard section
      style={[styles.metricGroup, columns < 4 && styles.metricGroupWrapped]}
      testID={testID}
    >
      {metrics.map((metric, index) => (
        <View key={metric.label} style={[styles.metricCell, adaptiveCellStyle]}>
          <AppText color="secondary" variant="caption">
            {metric.label}
          </AppText>
          <MaskedValue
            color={metric.color ?? "primary"}
            exactValue={metric.exactValue}
            masked={metric.masked}
            value={metric.value}
            variant="section"
            weight="bold"
          />
          {columns === 4 && index < metrics.length - 1 ? (
            <View style={styles.metricDivider} />
          ) : null}
        </View>
      ))}
    </PremiumCard>
  );
}

export function SectionHeader({ title }: { title: string }) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const shouldStack = getAdaptiveLayoutMode(fontScale) !== "standard";

  return (
    <View
      style={[styles.sectionHeader, shouldStack && styles.sectionHeaderStacked]}
    >
      <AppText accessibilityRole="header" variant="section" weight="medium">
        {title}
      </AppText>
    </View>
  );
}

export function CategoryIcon({
  assetClass = "neutral",
  size = 22,
}: {
  assetClass?: AssetClass | "neutral";
  size?: number;
}) {
  const { colors } = useTheme();
  const config = getAssetClassConfig(colors)[assetClass];

  return (
    <Ionicons
      accessible={false}
      color={config.color}
      name={config.icon}
      size={size}
    />
  );
}

export function assetClassLabel(assetClass: AssetClass) {
  return { cash: "Cash", crypto: "Crypto", debt: "Debt", etf: "Equity", stock: "Equity" }[assetClass];
}

export function GroupedListRow({
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  destructive = false,
  icon,
  meta,
  onPress,
  testID,
  title,
  value,
  selected = false,
  showChevron = false,
}: GroupedListRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const content = (
    <>
      {icon ? (
        <Ionicons
          accessible={false}
          color={destructive ? colors.loss : colors.text.secondary}
          name={icon}
          size={20}
        />
      ) : null}
      <View style={styles.groupedCopy}>
        <AppText style={destructive && styles.negativeText} weight="bold">
          {title}
        </AppText>
        {meta ? (
          <AppText color="secondary" variant="caption">
            {meta}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText color="secondary" variant="caption" weight="medium">
          {value}
        </AppText>
      ) : null}
      {showChevron && onPress ? (
        <Ionicons accessible={false} importantForAccessibility="no-hide-descendants"
          name="chevron-forward" size={20} color={colors.text.secondary} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? [title, meta, value].filter(Boolean).join(", ")}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        android_ripple={androidRipple()}
        onPress={onPress}
        style={({ pressed }) => [
          styles.groupedRow,
          selected && styles.groupedRowSelected,
          getPressedStateStyle({ pressed }),
        ]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.groupedRow} testID={testID}>
      {content}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  brandText: {
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radii.card,
    gap: spacing.sm,
    padding: spacing.cardInner,
  },
  elevatedCard: {
    backgroundColor: colors.surface.elevated,
  },
  openSection: {
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  groupedCopy: {
    flex: 1,
    gap: 2,
  },
  groupedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 58,
  },
  groupedRowSelected: {
    backgroundColor: colors.selected,
    borderRadius: radii.button,
    marginHorizontal: spacing.xs * -1,
    paddingHorizontal: spacing.xs,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerAction: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  headerCompact: { gap: spacing.sm },
  compactTitle: { fontSize: 24, lineHeight: 30 },
  iconButtonPlain: { backgroundColor: "transparent" },
  iconButtonProminent: { backgroundColor: colors.surface.elevated, borderRadius: radii.pill },
  headerActionStacked: {
    alignSelf: "flex-end",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  headerIdentity: {
    alignItems: "flex-start",
    flex: 1,
    flexDirection: "row",
    gap: spacing.md,
    minWidth: 0,
  },
  headerIdentityStacked: {
    flex: 0,
    flexBasis: "auto",
    flexGrow: 0,
    flexShrink: 0,
  },
  headerLeading: {
    alignSelf: "flex-start",
  },
  headerStacked: {
    alignItems: "stretch",
    flexDirection: "column",
  },
  heroCard: {
    gap: spacing.sm,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 13,
    // DESIGN.md: every interactive control is at least 48 x 48 dp (#719).
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  metricCell: {
    flex: 1,
    flexBasis: 0,
    gap: spacing.xs,
    minWidth: 0,
  },
  metricCellFull: {
    flexBasis: "100%",
  },
  metricCellHalf: {
    flexBasis: "45%",
  },
  metricDivider: {
    backgroundColor: colors.border.subtle,
    bottom: spacing.xs,
    position: "absolute",
    right: spacing.xs * -1,
    top: spacing.xs,
    width: StyleSheet.hairlineWidth,
  },
  metricGroup: {
    flexDirection: "row",
    gap: spacing.md,
  },
  metricGroupWrapped: {
    flexWrap: "wrap",
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
  secondaryText: {
    color: colors.text.secondary,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sectionHeaderStacked: {
    alignItems: "flex-start",
    flexDirection: "column",
  },
}));
