import { useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "@/src/theme";

import { AppButton } from "./AppButton";
import { AppText } from "./AppText";
import { SectionHeader } from "./Premium";

export function useSensitiveValueReveal(maskingEnabled: boolean) {
  const [isRevealed, setIsRevealed] = useState(() => !maskingEnabled);

  useLayoutEffect(() => {
    setIsRevealed(!maskingEnabled);
  }, [maskingEnabled]);

  return {
    isRevealed: !maskingEnabled || isRevealed,
    reveal: () => setIsRevealed(true),
  };
}

export function SensitiveValueReveal({
  onReveal,
  testID,
}: {
  onReveal: () => void;
  testID: string;
}) {
  return (
    <View style={styles.content} testID={testID}>
      <SectionHeader title="Reveal to review" />
      <AppText color="secondary">
        Sensitive financial values are hidden by your masking setting.
      </AppText>
      <AppButton
        accessibilityHint="Shows masked aggregate amounts on this screen"
        accessibilityLabel="Reveal sensitive values"
        accessibilityState={{ expanded: false }}
        onPress={onReveal}
        testID={`${testID}-button`}
        title="Reveal values"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
});
