import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Alert, AppState, Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText } from "@/src/components/common";
import { useAppLock, type AppLockState } from "@/src/services/security/appLock";
import { createThemedStyles, spacing, useTheme } from "@/src/theme";

/**
 * Covers the whole app while it is locked (#761). The app tree stays mounted
 * underneath so unsaved input survives, and a link opened while locked only
 * changes the hidden screen: nothing shows until the phone's lock is passed.
 * A modal sits above the navigator and its screens, which an overlay view
 * would not.
 */
export function AppLockGate({ appLockStore }: { appLockStore: StoreApi<AppLockState> }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { authenticating, error, locked, unlock } = useAppLock(appLockStore);
  const prompted = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      appLockStore.getState().handleAppStateChange(state);
    });
    return () => subscription.remove();
  }, [appLockStore]);

  async function handleUnlock() {
    const result = await unlock();
    if (result === "noDeviceLock") {
      Alert.alert(
        "App lock is off",
        "This phone no longer has a screen lock, so CogVest turned App lock off. Set a screen lock, then turn App lock on again in Settings.",
      );
    }
  }

  // Ask once each time the app locks; after a cancel, the button asks again.
  useEffect(() => {
    if (!locked) {
      prompted.current = false;
      return;
    }
    if (prompted.current || AppState.currentState !== "active") return;
    prompted.current = true;
    void handleUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prompt once per lock.
  }, [locked]);

  return (
    <Modal
      animationType="none"
      // Back must never dismiss the lock.
      onRequestClose={() => undefined}
      statusBarTranslucent
      visible={locked}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.content} testID="app-lock-screen">
          <Ionicons accessible={false} color={colors.primary} name="lock-closed-outline" size={40} />
          <AppText accessibilityRole="header" variant="title" weight="bold">CogVest is locked</AppText>
          <AppText color="secondary" style={styles.body}>
            Use your fingerprint, face or screen lock to open your portfolio.
          </AppText>
          {error ? (
            <AppText accessibilityLiveRegion="polite" style={[styles.body, { color: colors.loss }]} testID="app-lock-error">
              {error}
            </AppText>
          ) : null}
          <AppButton
            disabled={authenticating}
            onPress={() => { void handleUnlock(); }}
            testID="app-lock-unlock"
            title="Unlock"
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  body: { maxWidth: 320, textAlign: "center" },
  content: { alignItems: "center", gap: spacing.lg, padding: spacing.xl },
  screen: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
}));
