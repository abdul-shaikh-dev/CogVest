import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMonthEndSnapshotAutomation } from "@/src/features/progress";

function MonthEndSnapshotAutomation() {
  useMonthEndSnapshotAutomation();

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <MonthEndSnapshotAutomation />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: "#1C1B1F" },
            headerStyle: { backgroundColor: "#1C1B1F" },
            headerTintColor: "#E6E1E5",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-holding" options={{ title: "Add Holding" }} />
          <Stack.Screen name="sell-redeem" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
          <Stack.Screen
            name="visual-qa-seed"
            options={{ headerShown: false }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
