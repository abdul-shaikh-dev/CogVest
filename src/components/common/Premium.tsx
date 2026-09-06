import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, interaction, radii, spacing } from "@/src/theme";
import type { AssetClass } from "@/src/types";

import { AppText } from "./AppText";
import { MaskedValue } from "./MaskedValue";
import {
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "./pressableStyles";

type PremiumCardProps = {
  children: ReactNode;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type ScreenHeaderProps = {
  action?: ReactNode;
  leading?: ReactNode;
  subtitle: string;
  title: string;
};

type Metric = {
  color?: "primary" | "secondary";
  label: string;
  masked?: boolean;
  value: string;
};

type MetricGroupProps = {
  metrics: Metric[];
  testID?: string;
};

type GroupedListRowProps = {
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  meta?: string;
  onPress?: () => void;
  testID?: string;
  title: string;
  value?: string;
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

const assetClassConfig: Record<
  AssetClass | "neutral",
  { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  cash: { color: colors.cashBlue, icon: "wallet-outline", label: "Cash" },
  crypto: { color: colors.cryptoAmber, icon: "logo-bitcoin", label: "Crypto" },
  debt: { color: colors.blue, icon: "shield-outline", label: "Debt" },
  etf: { color: colors.primary, icon: "trending-up-outline", label: "Equity" },
  neutral: { color: colors.text.secondary, icon: "analytics-outline", label: "Info" },
  stock: { color: colors.primary, icon: "trending-up-outline", label: "Equity" },
};

export function PremiumCard({
  children,
  elevated = false,
  style,
  testID,
}: PremiumCardProps) {
  return (
    <View
      style={[styles.card, elevated && styles.elevatedCard, style]}
      testID={testID}
    >
      {children}
    </View>
  );
}

export function ScreenHeader({
  action,
  leading,
  subtitle,
  title,
}: ScreenHeaderProps) {
  const { fontScale } = useWindowDimensions();
  const shouldStack = getAdaptiveLayoutMode(fontScale) !== "standard";

  return (
    <View style={[styles.header, shouldStack && styles.headerStacked]}>
      <View style={styles.headerIdentity}>
        {leading ? <View style={styles.headerLeading}>{leading}</View> : null}
        <View style={styles.headerCopy}>
          <AppText accessibilityRole="header" variant="largeTitle" weight="bold">
            {title}
          </AppText>
          <AppText color="secondary">{subtitle}</AppText>
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
  accessibilityLabel,
  icon,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      android_ripple={androidRipple()}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        minimumTouchTargetStyle,
        getPressedStateStyle({ pressed }),
      ]}
      testID={testID}
    >
      <Ionicons
        accessible={false}
        color={colors.text.primary}
        name={icon}
        size={20}
      />
    </Pressable>
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
  const toneStyle =
    subValueTone === "positive"
      ? styles.positiveText
      : subValueTone === "negative"
        ? styles.negativeText
        : styles.secondaryText;

  return (
    <PremiumCard elevated style={styles.heroCard}>
      <AppText color="secondary">{label}</AppText>
      <MaskedValue masked={masked} value={value} variant="hero" weight="bold" />
      {subValue ? (
        <View style={styles.metricPill}>
          <AppText style={toneStyle} variant="caption" weight="bold">
            {subValue}
          </AppText>
        </View>
      ) : null}
    </PremiumCard>
  );
}

export function MetricGroup({ metrics, testID }: MetricGroupProps) {
  const { fontScale } = useWindowDimensions();
  const columns = getMetricColumnCount(fontScale);
  const adaptiveCellStyle =
    columns === 1
      ? styles.metricCellFull
      : columns === 2
        ? styles.metricCellHalf
        : undefined;

  return (
    <PremiumCard
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
            masked={metric.masked}
            value={metric.value}
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

export function SectionHeader({
  actionLabel,
  title,
}: {
  actionLabel?: string;
  title: string;
}) {
  const { fontScale } = useWindowDimensions();
  const shouldStack = getAdaptiveLayoutMode(fontScale) !== "standard";

  return (
    <View
      style={[styles.sectionHeader, shouldStack && styles.sectionHeaderStacked]}
    >
      <AppText accessibilityRole="header" variant="section" weight="medium">
        {title}
      </AppText>
      {actionLabel ? (
        <AppText style={styles.brandText} variant="caption" weight="bold">
          {actionLabel}
        </AppText>
      ) : null}
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
  const config = assetClassConfig[assetClass];

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
  return assetClassConfig[assetClass].label;
}

export function GroupedListRow({
  destructive = false,
  icon,
  meta,
  onPress,
  testID,
  title,
  value,
}: GroupedListRowProps) {
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
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={[title, meta, value].filter(Boolean).join(", ")}
        accessibilityRole="button"
        android_ripple={androidRipple()}
        onPress={onPress}
        style={({ pressed }) => [
          styles.groupedRow,
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

const styles = StyleSheet.create({
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
    height: 46,
    justifyContent: "center",
    width: 46,
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
  metricPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(52,199,89,0.12)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
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
});
