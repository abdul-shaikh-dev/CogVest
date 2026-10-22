import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppButton,
  AppText,
  SectionHeader,
  androidRipple,
  getPressedStateStyle,
  minimumTouchTargetStyle,
} from "@/src/components/common";
import {
  MONTHLY_CHART_RANGES,
  type MonthlyChartCustomRange,
  type MonthlyChartRange,
} from "@/src/domain/calculations";
import { useReducedMotionPreference } from "@/src/hooks";
import { interaction, spacing } from "@/src/theme";

import { useStyles } from "./progressStyles";
import { formatMonth, formatShortMonth } from "./progressViewModel";

export function ChartRangeSelector({
  onChange,
  onOpenCustom,
  selectedRange,
  testIDPrefix,
}: {
  onChange: (range: MonthlyChartRange) => void;
  onOpenCustom: () => void;
  selectedRange: MonthlyChartRange;
  testIDPrefix: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.rangeSelector}>
      {MONTHLY_CHART_RANGES.map((range) => {
        const isSelected = selectedRange === range;
        const chartName = testIDPrefix.startsWith("portfolio")
          ? "Portfolio Growth"
          : "Value by asset class";

        return (
          <Pressable
            accessibilityLabel={range === "Custom"
              ? `${chartName}: edit custom range`
              : `${chartName}: show ${range}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            android_ripple={androidRipple(
              isSelected
                ? interaction.primaryRippleColor
                : interaction.rippleColor,
            )}
            key={range}
            onPress={() => range === "Custom" ? onOpenCustom() : onChange(range)}
            style={({ pressed }) => [
              styles.rangeChip,
              minimumTouchTargetStyle,
              isSelected ? styles.rangeChipSelected : null,
              getPressedStateStyle({ pressed }),
            ]}
            testID={`${testIDPrefix}-${range}`}
          >
            <AppText
              color={isSelected ? "inverse" : "secondary"}
              variant="caption"
              weight="bold"
            >
              {range}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MonthPickerField({
  label,
  months,
  onChange,
  testID,
  value,
}: {
  label: string;
  months: string[];
  onChange: (month: string) => void;
  testID: string;
  value: string;
}) {
  const styles = useStyles();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.monthPickerContainer}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <Pressable
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.monthPickerField,
          getPressedStateStyle({ pressed }),
        ]}
        testID={testID}
      >
        <AppText style={{ flex: 1 }} variant="caption" weight="bold">
          {value ? formatMonth(value) : "Choose month"}
        </AppText>
        <AppText color="secondary" variant="caption">
          ⌄
        </AppText>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen}
      >
        <View style={styles.monthPickerOverlay}>
          <Pressable
            accessibilityLabel="Close month picker"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.monthPickerSheet}>
            <View style={styles.monthPickerHeader}>
              <AppText variant="title" weight="bold">
                {label}
              </AppText>
              <AppText color="secondary" variant="caption">
                Available completed months
              </AppText>
            </View>
            <ScrollView
              contentContainerStyle={styles.monthPickerOptions}
              keyboardShouldPersistTaps="handled"
            >
              {months.map((month) => {
                const isSelected = month === value;

                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    key={month}
                    onPress={() => {
                      onChange(month);
                      setIsOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickerOption,
                      isSelected ? styles.monthPickerOptionSelected : null,
                      getPressedStateStyle({ pressed }),
                    ]}
                    testID={`${testID}-${month}`}
                  >
                    <AppText weight={isSelected ? "bold" : "medium"}>
                      {formatMonth(month)}
                    </AppText>
                    {isSelected ? (
                      <AppText style={styles.gainText} variant="caption">
                        Selected
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function CustomMonthRangeControls({
  appliedRange,
  availableMonths,
  chartTitle,
  onCancel,
  onApply,
  testIDPrefix,
}: {
  appliedRange: MonthlyChartCustomRange;
  availableMonths: string[];
  chartTitle: string;
  onCancel: () => void;
  onApply: (range: MonthlyChartCustomRange) => void;
  testIDPrefix: string;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const [startMonth, setStartMonth] = useState(appliedRange.startMonth);
  const [endMonth, setEndMonth] = useState(appliedRange.endMonth);
  const [error, setError] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<"end" | "start" | null>(null);
  const [activeYear, setActiveYear] = useState("");
  const [isChoosingYear, setIsChoosingYear] = useState(false);
  const availableStartMonths = availableMonths.slice(0, -1);
  const availableEndMonths = availableMonths.filter(
    (month) => !startMonth || month > startMonth,
  );

  useEffect(() => {
    setStartMonth(appliedRange.startMonth);
    setEndMonth(appliedRange.endMonth);
    setError(null);
  }, [appliedRange.endMonth, appliedRange.startMonth]);

  function changeStartMonth(nextStartMonth: string) {
    setStartMonth(nextStartMonth);
    setEndMonth((currentEndMonth) =>
      currentEndMonth > nextStartMonth
        ? currentEndMonth
        : availableMonths.at(-1) ?? nextStartMonth,
    );
    setError(null);
  }

  function changeEndMonth(nextEndMonth: string) {
    setEndMonth(nextEndMonth);
    setError(null);
  }

  function applyRange() {
    if (!startMonth || !endMonth) {
      setError("Choose both months.");
      return;
    }

    if (startMonth >= endMonth) {
      setError("To month must be later than From month.");
      return;
    }

    setError(null);
    onApply({ endMonth, startMonth });
  }

  const activeMonths = activePicker === "start"
    ? availableStartMonths
    : availableEndMonths;
  const activeValue = activePicker === "start" ? startMonth : endMonth;
  const activeLabel = activePicker === "start" ? "From month" : "To month";
  const activeYears = [...new Set(activeMonths.map((month) => month.slice(0, 4)))].sort();
  const activeYearIndex = activeYears.indexOf(activeYear);
  const activeYearMonths = activeMonths.filter((month) => month.startsWith(`${activeYear}-`));

  function openPicker(field: "end" | "start") {
    const value = field === "start" ? startMonth : endMonth;
    const fieldMonths = field === "start" ? availableStartMonths : availableEndMonths;
    setActivePicker(field);
    setActiveYear((value || fieldMonths.at(-1) || "").slice(0, 4));
    setIsChoosingYear(false);
  }

  function closeOrReturn() {
    if (isChoosingYear) {
      setIsChoosingYear(false);
      return;
    }

    if (activePicker) {
      setActivePicker(null);
      return;
    }

    onCancel();
  }

  return (
    <Modal
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={closeOrReturn}
      testID={`${testIDPrefix}-modal`}
      transparent
      visible
    >
      <View style={[styles.monthPickerOverlay, { paddingBottom: insets.bottom + spacing.md }]}>
        <View
          accessibilityViewIsModal
          style={styles.monthPickerSheet}
          testID={`${testIDPrefix}-panel`}
        >
          {activePicker ? (
            <>
              <View style={styles.monthPickerHeader}>
                <AppText variant="title" weight="bold">{activeLabel}</AppText>
                <AppText color="secondary" variant="caption">
                  Current selection: {activeValue ? formatMonth(activeValue) : "Not selected"}
                </AppText>
              </View>
              {isChoosingYear ? (
                <>
                  <AppText color="secondary" variant="caption">
                    Choose a year containing valid stored months.
                  </AppText>
                  <ScrollView contentContainerStyle={styles.yearPickerGrid}>
                    {[...activeYears].reverse().map((year) => {
                      const isSelected = year === activeYear;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected }}
                          key={year}
                          onPress={() => {
                            setActiveYear(year);
                            setIsChoosingYear(false);
                          }}
                          style={({ pressed }) => [
                            styles.yearPickerOption,
                            minimumTouchTargetStyle,
                            isSelected ? styles.monthPickerOptionSelected : null,
                            getPressedStateStyle({ pressed }),
                          ]}
                          testID={`${testIDPrefix}-${activePicker}-year-${year}`}
                        >
                          <AppText weight={isSelected ? "bold" : "medium"}>{year}</AppText>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <AppButton
                    onPress={() => setIsChoosingYear(false)}
                    title="Back to months"
                    variant="secondary"
                  />
                </>
              ) : (
                <>
                  <View style={styles.yearNavigator}>
                    <AppButton
                      accessibilityLabel={`Show previous available year for ${activeLabel.toLowerCase()}`}
                      disabled={activeYearIndex <= 0}
                      onPress={() => setActiveYear(activeYears[activeYearIndex - 1] ?? activeYear)}
                      testID={`${testIDPrefix}-${activePicker}-previous-year`}
                      title="‹"
                      variant="secondary"
                    />
                    <Pressable
                      accessibilityLabel={`Choose year. Showing ${activeYear}`}
                      accessibilityRole="button"
                      onPress={() => setIsChoosingYear(true)}
                      style={({ pressed }) => [styles.yearPickerButton, getPressedStateStyle({ pressed })]}
                      testID={`${testIDPrefix}-${activePicker}-choose-year`}
                    >
                      <AppText color="secondary" variant="caption">Year</AppText>
                      <AppText variant="title" weight="bold">{activeYear}</AppText>
                    </Pressable>
                    <AppButton
                      accessibilityLabel={`Show next available year for ${activeLabel.toLowerCase()}`}
                      disabled={activeYearIndex < 0 || activeYearIndex >= activeYears.length - 1}
                      onPress={() => setActiveYear(activeYears[activeYearIndex + 1] ?? activeYear)}
                      testID={`${testIDPrefix}-${activePicker}-next-year`}
                      title="›"
                      variant="secondary"
                    />
                  </View>
                  <View style={styles.monthChoiceGrid}>
                    {activeYearMonths.map((month) => {
                      const isSelected = month === activeValue;
                      return (
                        <Pressable
                          accessibilityLabel={formatMonth(month)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: isSelected }}
                          key={month}
                          onPress={() => {
                            if (activePicker === "start") changeStartMonth(month);
                            else changeEndMonth(month);
                            setActivePicker(null);
                          }}
                          style={({ pressed }) => [
                            styles.monthChoice,
                            minimumTouchTargetStyle,
                            isSelected ? styles.monthPickerOptionSelected : null,
                            getPressedStateStyle({ pressed }),
                          ]}
                          testID={`${testIDPrefix}-${activePicker}-${month}`}
                        >
                          <AppText align="center" weight={isSelected ? "bold" : "medium"}>
                            {formatShortMonth(month)}
                          </AppText>
                          {isSelected ? (
                            <AppText align="center" style={styles.gainText} variant="caption">Selected</AppText>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                  <AppButton onPress={() => setActivePicker(null)} title="Back to range" variant="secondary" />
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.monthPickerHeader}>
                <AppText variant="title" weight="bold">{chartTitle} range</AppText>
                <AppText color="secondary" variant="caption">
                  Choose completed months. The chart changes only after you apply.
                </AppText>
              </View>
              <View style={styles.customRangeFields}>
                {([
                  { key: "start", label: "From month", value: startMonth },
                  { key: "end", label: "To month", value: endMonth },
                ] as const).map((field) => (
                  <View key={field.key} style={styles.customRangeField}>
                    <AppText color="secondary" variant="caption">{field.label}</AppText>
                    <Pressable
                      accessibilityLabel={`Choose ${field.label.toLowerCase()}`}
                      accessibilityRole="button"
                      onPress={() => openPicker(field.key)}
                      style={({ pressed }) => [styles.monthPickerField, getPressedStateStyle({ pressed })]}
                      testID={`${testIDPrefix}-${field.key}`}
                    >
                      <AppText variant="caption" weight="bold">
                        {field.value ? formatMonth(field.value) : "Choose month"}
                      </AppText>
                      <AppText color="secondary" variant="caption">Change</AppText>
                    </Pressable>
                  </View>
                ))}
              </View>
              {error ? (
                <AppText style={styles.lossText} testID={`${testIDPrefix}-error`} variant="caption">
                  {error}
                </AppText>
              ) : null}
              <View style={styles.customRangeActions}>
                <AppButton
                  onPress={onCancel}
                  style={styles.customRangeAction}
                  testID={`${testIDPrefix}-cancel`}
                  title="Cancel"
                  variant="secondary"
                />
                <AppButton
                  onPress={applyRange}
                  style={styles.customRangeAction}
                  testID={`${testIDPrefix}-apply`}
                  title="Apply range"
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function ChartRangeContext({
  monthLabels,
  hasGaps,
  testID,
}: {
  monthLabels: string[];
  hasGaps: boolean;
  testID: string;
}) {
  const styles = useStyles();
  const firstMonth = monthLabels[0];
  const lastMonth = monthLabels.at(-1);
  const displayedRange = firstMonth && lastMonth
    ? firstMonth === lastMonth
      ? firstMonth
      : `${firstMonth} to ${lastMonth}`
    : "No stored months";

  return (
    <View style={styles.chartRangeContext} testID={testID}>
      <AppText color="secondary" variant="caption">
        {displayedRange}{hasGaps ? " · Missing months" : ""}
      </AppText>
    </View>
  );
}

export function ChartCardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const styles = useStyles();
  return (
    <View style={styles.chartCardHeader}>
      <SectionHeader title={title} />
      <AppText color="secondary" variant="caption">{subtitle}</AppText>
    </View>
  );
}
