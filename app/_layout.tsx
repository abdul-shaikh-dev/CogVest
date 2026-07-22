import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSyncExternalStore } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMonthEndSnapshotAutomation } from "@/src/features/progress";
import { RecoveryScreen } from "@/src/features/recovery";
import { getPortfolioStore } from "@/src/store";

function MonthEndSnapshotAutomation() {
  useMonthEndSnapshotAutomation();

  return null;
}

export default function RootLayout() {
  const store = getPortfolioStore();
  const recovery = useSyncExternalStore(
    store.subscribe,
    () => store.getState().storageRecovery,
    () => store.getState().storageRecovery,
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {recovery ? (
          <RecoveryScreen
            affectedAreas={recovery.incidents.map(
              (incident) => incident.displayName,
            )}
            onReset={() => store.getState().resetAffectedStorage()}
            recoveryCopiesPreserved={recovery.incidents.every(
              (incident) => incident.preserved,
            )}
          />
        ) : (
          <>
            <MonthEndSnapshotAutomation />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: "#1C1B1F" },
                headerStyle: { backgroundColor: "#1C1B1F" },
                headerTintColor: "#E6E1E5",
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="add-holding" options={{ headerShown: false }} />
              <Stack.Screen name="cash-entry" options={{ headerShown: false }} />
              <Stack.Screen name="sell-redeem" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen
                name="review-snapshot"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="visual-qa-seed"
                options={{ headerShown: false }}
              />
            </Stack>
          </>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
