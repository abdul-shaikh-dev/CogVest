import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import {
  AppButton,
  AppText,
  MaskedValue,
  androidRipple,
  getPressedStateStyle,
} from "@/src/components/common";
import type { SavedSnapshotRecalculation, SnapshotDriftField, SnapshotRecordDrift } from "@/src/domain/calculations";
import { formatINR } from "@/src/domain/formatters";
import type { MonthlySnapshot } from "@/src/types";
import { useTheme } from "@/src/theme";

import type { MonthRecalculation } from "./SnapshotDriftNotice";
import { useStyles } from "./monthlyHistoryStyles";
import { formatMonth } from "./monthlyHistoryViewModel";

/** Work done per slice before yielding to the UI; one month can run past it. */
const sliceMs = 12;

const fieldLabels: Record<SnapshotDriftField, string> = {
  cashValue: "cash",
  investedValue: "invested basis",
  monthlyInvestment: "monthly investment",
};

export type ReviewedMonth = { drift: SnapshotRecordDrift; result: SavedSnapshotRecalculation };

/** "Changed: invested basis and monthly investment" for a flagged month. */
export function describeChangedFields(fields: readonly SnapshotDriftField[]) {
  const labels = fields.map((field) => fieldLabels[field]);
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}` : labels[0];
  return `Changed: ${list}`;
}

/** "Replace 1 month" / "Replace 5 months". */
export function replaceLabel(count: number) {
  return `Replace ${count} ${count === 1 ? "month" : "months"}`;
}

/**
 * Recalculates every flagged month in short slices between frames, so a long
 * history never holds the screen. Months come back newest first.
 */
function useReviewedMonths(
  drift: ReadonlyMap<string, SnapshotRecordDrift>,
  preview: MonthRecalculation["preview"],
) {
  const [reviewed, setReviewed] = useState<ReviewedMonth[] | null>(null);
  const [checked, setChecked] = useState(0);

  useEffect(() => {
    const flagged = [...drift.values()].sort((left, right) => right.month.localeCompare(left.month));
    const found: ReviewedMonth[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const started = Date.now();
      while (found.length < flagged.length && Date.now() - started < sliceMs) {
        const entry = flagged[found.length];
        found.push({ drift: entry, result: preview(entry.month) });
      }
      setChecked(found.length);
      if (found.length < flagged.length) timer = setTimeout(step, 0);
      else setReviewed(found);
    };
    timer = setTimeout(step, 0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
    // The review works from the months flagged when it opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { checked, reviewed, total: drift.size };
}

/**
 * Every saved month that no longer matches records (#751), recalculated side by
 * side with its saved value. The ticked months are replaced in one write.
 */
export function OutOfDateMonthsReview({
  drift,
  maskWealthValues,
  onDone,
  recalculation,
}: {
  drift: ReadonlyMap<string, SnapshotRecordDrift>;
  maskWealthValues: boolean;
  onDone: () => void;
  recalculation: MonthRecalculation;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { checked, reviewed, total } = useReviewedMonths(drift, recalculation.preview);
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<string | null>(null);

  if (!reviewed) {
    return (
      <View style={styles.reviewSection} testID="out-of-date-review-loading">
        <AppText color="secondary">Recalculating {checked} of {total} months…</AppText>
      </View>
    );
  }

  const chosen = reviewed.flatMap(({ drift: entry, result }) =>
    result.ok && !unticked.has(entry.month) ? [result.snapshot] : []);

  function toggle(month: string) {
    setFailure(null);
    setUnticked((current) => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function replaceChosen(months: readonly MonthlySnapshot[]) {
    const result = recalculation.replaceAll(months);
    if (result.ok) onDone();
    else setFailure(result.reason);
  }

  return (
    <View style={styles.reviewSection} testID="out-of-date-review">
      <AppText color="secondary" variant="caption">
        These saved months differ from what your records give for them, usually because records were added or
        changed after the month was saved. Untick any month whose saved values you want to keep.
      </AppText>
      {reviewed.map(({ drift: entry, result }) => {
        const month = entry.month;
        const isTicked = result.ok && !unticked.has(month);
        const saved = formatINR(entry.saved.portfolioValue);
        const body = (
          <>
            {result.ok ? (
              <Ionicons
                color={isTicked ? colors.primary : colors.text.secondary}
                name={isTicked ? "checkbox" : "square-outline"}
                size={22}
              />
            ) : (
              <Ionicons color={colors.text.secondary} name="alert-circle-outline" size={22} />
            )}
            <View style={styles.reviewRowCopy}>
              <AppText weight="bold">{formatMonth(month)}</AppText>
              <View style={styles.reviewValues}>
                <AppText color="secondary" variant="caption">Saved</AppText>
                <MaskedValue exactValue={saved} masked={maskWealthValues} testID={`out-of-date-saved-${month}`}
                  value={saved} variant="caption" />
              </View>
              {result.ok ? (
                <View style={styles.reviewValues}>
                  <AppText color="secondary" variant="caption">From records</AppText>
                  <MaskedValue exactValue={formatINR(result.snapshot.portfolioValue)} masked={maskWealthValues}
                    testID={`out-of-date-recalculated-${month}`} value={formatINR(result.snapshot.portfolioValue)}
                    variant="caption" weight="bold" />
                </View>
              ) : null}
              <AppText color="secondary" variant="caption">
                {result.ok ? describeChangedFields(entry.fields) : `Can't be recalculated: ${result.reason}`}
              </AppText>
            </View>
          </>
        );

        return result.ok ? (
          <Pressable
            accessibilityLabel={`${formatMonth(month)}. ${describeChangedFields(entry.fields)}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isTicked }}
            android_ripple={androidRipple()}
            key={month}
            onPress={() => toggle(month)}
            style={({ pressed }) => [styles.reviewRow, getPressedStateStyle({ pressed })]}
            testID={`out-of-date-month-${month}`}
          >
            {body}
          </Pressable>
        ) : (
          <View key={month} style={styles.reviewRow} testID={`out-of-date-month-${month}`}>{body}</View>
        );
      })}
      <AppText color="secondary" variant="caption">
        Replacing marks these months as automatic. Your records are not changed.
      </AppText>
      <AppButton
        disabled={chosen.length === 0}
        onPress={() => replaceChosen(chosen)}
        testID="confirm-replace-out-of-date-months"
        title={replaceLabel(chosen.length)}
      />
      <AppButton onPress={onDone} testID="cancel-replace-out-of-date-months" title="Keep saved values" variant="secondary" />
      {failure ? (
        <AppText accessibilityRole="alert" color="secondary" testID="replace-out-of-date-months-error" variant="caption">
          {failure}
        </AppText>
      ) : null}
    </View>
  );
}
