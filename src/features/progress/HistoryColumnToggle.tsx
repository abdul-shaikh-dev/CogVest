import { Pressable, View } from "react-native";

import { AppText, androidRipple, getPressedStateStyle } from "@/src/components/common";

import { useStyles } from "./monthlyHistoryStyles";
import type { HistoryColumn } from "./monthlyHistoryViewModel";

const options: { label: string; value: HistoryColumn }[] = [
  { label: "Month gain", value: "monthGain" },
  { label: "Vs invested", value: "vsInvested" },
];

/** Chooses what the history list's last column shows (#743). */
export function HistoryColumnToggle({ onChange, value }: { onChange: (value: HistoryColumn) => void; value: HistoryColumn }) {
  const styles = useStyles();
  return (
    <View accessibilityLabel="Compare each month by" accessibilityRole="radiogroup" style={styles.columnToggle}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            android_ripple={androidRipple()}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.columnToggleOption,
              isSelected ? styles.columnToggleSelected : null,
              getPressedStateStyle({ pressed }),
            ]}
            testID={`history-column-${option.value}`}
          >
            <AppText color={isSelected ? "primary" : "secondary"} variant="caption" weight="bold">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
