import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "@/src/components/common";
import { RecoveryScreen } from "@/src/features/recovery";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

function RecoveryFixture({ preserved }: { preserved: boolean }) {
  const [resets, setResets] = useState(0);
  return (
    <View style={{ flex: 1, paddingTop: 40 }}>
      <AppText testID="recovery-qa-result">
        Synthetic fixture only. Reset callbacks: {resets}
      </AppText>
      <RecoveryScreen
        affectedAreas={[
          "Portfolio records",
          "Monthly snapshots and historical valuation evidence",
          "Current quote cache",
        ]}
        recoveryCopiesPreserved={preserved}
        onReset={() => setResets((count) => count + 1)}
      />
    </View>
  );
}

export default function RecoveryQaRoute() {
  const { token, preserved } = useLocalSearchParams<{ token?: string; preserved?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) {
    return <AppText testID="recovery-qa-blocked">Recovery QA is unavailable.</AppText>;
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <RecoveryFixture key={preserved} preserved={preserved !== "no"} />
    </>
  );
}
