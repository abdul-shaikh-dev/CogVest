import { Ionicons } from "@expo/vector-icons";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useMonthEndSnapshotAutomation } from "@/src/features/progress";
import { RecoveryScreen } from "@/src/features/recovery";
import { getPortfolioStore } from "@/src/store";
import { isVisualQaSessionActive } from "@/src/testing/visualQaSeed";
import { colors } from "@/src/theme";

function MonthEndSnapshotAutomation({ enabled }: { enabled: boolean }) {
  useMonthEndSnapshotAutomation({ enabled });

  return null;
}

const FONT_LOAD_ATTEMPTS = 3;
const FONT_LOAD_TIMEOUT_MS = 10000;

async function loadFontWithTimeout(timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      Ionicons.loadFont(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Required interface assets timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function loadRequiredFonts({
  timeoutMs = FONT_LOAD_TIMEOUT_MS,
}: { timeoutMs?: number } = {}) {
  let lastError: unknown;

  for (let attempt = 0; attempt < FONT_LOAD_ATTEMPTS; attempt += 1) {
    try {
      await loadFontWithTimeout(timeoutMs);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Required interface assets could not be loaded.");
}

export default function RootLayout() {
  const store = getPortfolioStore();
  const pathname = usePathname();
  const [fontLoadAttempt, setFontLoadAttempt] = useState(0);
  const [fontState, setFontState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const recovery = useSyncExternalStore(
    store.subscribe,
    () => store.getState().storageRecovery,
    () => store.getState().storageRecovery,
  );

  useEffect(() => {
    let active = true;

    setFontState("loading");
    loadRequiredFonts().then(
      () => {
        if (active) setFontState("ready");
      },
      () => {
        if (active) setFontState("error");
      },
    );

    return () => {
      active = false;
    };
  }, [fontLoadAttempt]);

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
        ) : fontState !== "ready" ? (
          <View style={styles.assetGate} testID="app-asset-gate">
            {fontState === "loading" ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.assetGateTitle}>
                  CogVest could not finish loading
                </Text>
                <Text style={styles.assetGateBody}>
                  Try again. If this continues, close and reopen CogVest.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setFontLoadAttempt((attempt) => attempt + 1)
                  }
                  style={styles.assetGateButton}
                  testID="retry-app-assets"
                >
                  <Text style={styles.assetGateButtonText}>Try again</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            <MonthEndSnapshotAutomation
              enabled={
                pathname !== "/visual-qa-seed" &&
                !isVisualQaSessionActive()
              }
            />
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
              <Stack.Screen
                name="opening-position"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="holding-transactions"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="trade" options={{ headerShown: false }} />
              <Stack.Screen name="manage-assets" options={{ headerShown: false }} />
              <Stack.Screen name="asset" options={{ headerShown: false }} />
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
              <Stack.Screen
                name="e2e-evidence"
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
  assetGate: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  assetGateBody: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
    textAlign: "center",
  },
  assetGateButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 24,
    minHeight: 48,
    minWidth: 128,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  assetGateButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  assetGateTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  root: {
    flex: 1,
  },
});
