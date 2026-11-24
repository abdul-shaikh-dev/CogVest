import { useState } from "react";
import { KeyboardAvoidingView, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  IconButton,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
} from "@/src/components/common";
import { FormTextField } from "@/src/components/forms";
import { allocationTargetClasses } from "@/src/domain/allocationTargets";
import { usePortfolioFields } from "@/src/hooks";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, createThemedStyles } from "@/src/theme";

import {
  buildAllocationTargets,
  targetDraftFrom,
  targetDraftTotal,
  targetTotalText,
  type TargetClass,
  type TargetDraft,
  type TargetDraftErrors,
} from "./targetForm";

const labels: Record<TargetClass, string> = {
  cash: "Cash (%)",
  crypto: "Crypto, including Futures equity (%)",
  debt: "Debt, including PPF and EPF (%)",
  equity: "Equity (%)",
};

/** The target mix editor in Settings (#764). */
export function AllocationTargetsScreen({ onBack, store = getPortfolioStore() }: {
  onBack: () => void;
  store?: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const { preferences } = usePortfolioFields(store, ["preferences"]);
  const saved = preferences.allocationTargets;
  const [draft, setDraft] = useState<TargetDraft>(() => targetDraftFrom(saved));
  const [errors, setErrors] = useState<TargetDraftErrors>({});
  const total = targetDraftTotal(draft);

  function save() {
    const built = buildAllocationTargets(draft);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    const result = store.getState().saveAllocationTargets(built.targets);
    if (result.status === "rejected") {
      setErrors({ total: result.problems[0] });
      return;
    }
    onBack();
  }

  function clear() {
    store.getState().saveAllocationTargets(null);
    onBack();
  }

  return (
    <KeyboardAvoidingView behavior="height" style={styles.flex}>
      <ScreenContainer scroll testID="allocation-targets-screen">
        <View style={styles.content}>
          <ScreenHeader
            leading={<IconButton accessibilityLabel="Back" icon="arrow-back" onPress={onBack} />}
            subtitle="The mix you aim for"
            title="Target allocation"
          />
          <AppText color="secondary">
            The Dashboard compares these targets with your actual allocation. They are for information only.
          </AppText>
          <PremiumCard section style={styles.form}>
            {allocationTargetClasses.map((key) => (
              <FormTextField
                error={errors[key]}
                key={key}
                keyboardType="decimal-pad"
                label={labels[key]}
                onChangeText={(text) => {
                  setDraft((current) => ({ ...current, [key]: text }));
                  setErrors({});
                }}
                placeholder="0"
                testID={`allocation-target-${key}`}
                value={draft[key]}
              />
            ))}
            <AppText
              accessibilityLiveRegion="polite"
              testID="allocation-target-total"
              weight={total === 100 ? "bold" : "regular"}
            >
              {targetTotalText(total)}
            </AppText>
            {errors.total ? (
              <AppText style={styles.error} testID="allocation-target-error" variant="caption">{errors.total}</AppText>
            ) : null}
          </PremiumCard>
          <AppButton onPress={save} testID="allocation-target-save" title="Save targets" />
          {saved ? (
            <AppButton onPress={clear} testID="allocation-target-clear" title="Remove targets" variant="secondary" />
          ) : null}
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  content: { gap: spacing.cardGap, paddingTop: spacing.sm },
  error: { color: colors.loss },
  flex: { flex: 1 },
  form: { gap: spacing.sm, paddingVertical: spacing.sm },
}));
