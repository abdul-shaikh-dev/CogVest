import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors, interaction, radii, spacing } from "@/src/theme";
import type { AssetClass } from "@/src/types";

import { AppText } from "./AppText";
import { MaskedValue } from "./MaskedValue";

type PremiumCardProps = {
  children: ReactNode;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type ScreenHeaderProps = {
  action?: ReactNode;
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

const assetClassConfig: Record<
  AssetClass | "neutral",
  { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  cash: { color: colors.cashBlue, icon: "wallet-outline", label: "Cash" },
  crypto: { color: colors.cryptoAmber, icon: "logo-bitcoin", label: "Crypto" },
  etf: { color: colors.blue, icon: "shield-outline", label: "Debt" },
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

export function ScreenHeader({ action, subtitle, title }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <AppText variant="largeTitle" weight="bold">
          {title}
        </AppText>
        <AppText color="secondary">{subtitle}</AppText>
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
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
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      testID={testID}
    >
      <Ionicons color={colors.text.primary} name={icon} size={20} />
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
  return (
    <PremiumCard style={styles.metricGroup} testID={testID}>
      {metrics.map((metric, index) => (
        <View key={metric.label} style={styles.metricCell}>
          <AppText color="secondary" variant="caption">
            {metric.label}
          </AppText>
          <MaskedValue
            color={metric.color ?? "primary"}
            masked={metric.masked}
            value={metric.value}
            weight="bold"
          />
          {index < metrics.length - 1 ? <View style={styles.metricDivider} /> : null}
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
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="title" weight="bold">
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

  return <Ionicons color={config.color} name={config.icon} size={size} />;
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
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.groupedRow, pressed && styles.pressed]}
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
    gap: spacing.cardInner,
    padding: spacing.md,
  },
  elevatedCard: {
    backgroundColor: colors.surface.elevated,
  },
  groupedCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  groupedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.cardInner,
    minHeight: 64,
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
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroCard: {
    gap: spacing.sm,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  metricCell: {
    flex: 1,
    gap: spacing.xs,
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
  metricPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(52,199,89,0.12)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  negativeText: {
    color: colors.loss,
  },
  positiveText: {
    color: colors.profit,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
  secondaryText: {
    color: colors.text.secondary,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
