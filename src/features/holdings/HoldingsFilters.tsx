import { Pressable, View } from "react-native";

import {
  AppText,
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import { interaction } from "@/src/theme";

import type { HoldingFilter } from "./holdingsReview";
import { useStyles } from "./holdingsStyles";
import { filterOrder, getFilterLabel } from "./holdingsViewModel";

export function DestinationTab({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      android_ripple={androidRipple(
        active ? interaction.primaryRippleColor : interaction.rippleColor,
      )}
      onPress={onPress}
      style={({ pressed }) => [
        styles.destinationTab,
        active && styles.destinationTabActive,
        getPressedStateStyle({ pressed }),
      ]}
      testID={testID}
    >
      <AppText color={active ? "primary" : "secondary"} weight="bold">
        {label}
      </AppText>
    </Pressable>
  );
}

export function FilterRow({
  allocationAvailable,
  counts,
  onSelect,
  selected,
}: {
  allocationAvailable: boolean;
  counts: Record<HoldingFilter, number>;
  onSelect: (filter: HoldingFilter) => void;
  selected: HoldingFilter;
}) {
  const styles = useStyles();
  return (
    <View style={styles.filters}>
      {filterOrder.map((filter) => {
        const active = selected === filter;
        const disabled = filter === "high-allocation" && !allocationAvailable;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: active }}
            android_ripple={androidRipple(
              active ? interaction.primaryRippleColor : interaction.rippleColor,
            )}
            key={filter}
            onPress={() => onSelect(filter)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.filterChip,
              minimumTouchTargetStyle,
              active && styles.filterChipActive,
              getPressedStateStyle({ pressed }),
            ]}
            testID={`holdings-filter-${filter}`}
          >
            <AppText
              color={active ? "inverse" : "secondary"}
              variant="caption"
              weight="bold"
            >
              {getFilterLabel(filter)} {counts[filter]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
