import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppText } from "@/src/components/common";
import { appLockRelockOptions, relockLabel } from "@/src/domain/appLock";
import {
  expoDeviceAuth,
  useAppLock,
  type AppLockState,
  type DeviceAuth,
} from "@/src/services/security/appLock";
import { createThemedStyles, interaction, radii, spacing, useTheme } from "@/src/theme";

/** Whether the phone has a screen lock, checked again whenever CogVest returns. */
function useDeviceLockAvailable(auth: DeviceAuth) {
  const [available, setAvailable] = useState<boolean>();
  useEffect(() => {
    let active = true;
    const check = () => {
      auth.hasDeviceLock().then(
        (value) => { if (active) setAvailable(value); },
        () => { if (active) setAvailable(false); },
      );
    };
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [auth]);
  return available;
}

type Props = {
  appLockStore: StoreApi<AppLockState>;
  auth?: DeviceAuth;
};

/** The App lock switch and relock delay, in Settings (#761). */
export function AppLockSettings({ appLockStore, auth = expoDeviceAuth }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { authenticating, disable, enable, setRelockAfter, settings } = useAppLock(appLockStore);
  const available = useDeviceLockAvailable(auth);
  const [message, setMessage] = useState<string>();
  // Turning the lock off stays possible even if the screen lock was removed.
  const canToggle = !authenticating && (settings.enabled || available === true);

  async function handleToggle() {
    setMessage(undefined);
    try {
      const changed = settings.enabled ? await disable() : await enable();
      if (!changed) setMessage(appLockStore.getState().error ?? "App lock was not changed.");
    } catch {
      setMessage("The App lock setting could not be saved. Try again.");
    }
  }

  return (
    <View style={styles.group} testID="app-lock-settings">
      <Pressable
        accessibilityHint="Asks for your fingerprint, face or screen lock to open CogVest."
        accessibilityLabel="Toggle App lock"
        accessibilityRole="switch"
        accessibilityState={{ checked: settings.enabled, disabled: !canToggle }}
        disabled={!canToggle}
        onPress={() => { void handleToggle(); }}
        style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed, !canToggle && styles.disabled]}
        testID="app-lock-toggle"
      >
        <View style={styles.toggleCopy}>
          <AppText weight="bold">App lock</AppText>
          <AppText color="secondary">
            Ask for your fingerprint, face or screen lock to open CogVest.
          </AppText>
          <AppText color="secondary" variant="caption">
            {settings.enabled
              ? "Screenshots and the recent-apps preview are blocked while App lock is on."
              : "Off by default. This setting stays on this phone and is not part of a backup."}
          </AppText>
        </View>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[styles.switchTrack, settings.enabled && styles.switchOn]}
        >
          <View style={[styles.switchThumb, settings.enabled && styles.switchThumbOn]} />
        </View>
      </Pressable>

      {available === false && !settings.enabled ? (
        <AppText color="secondary" testID="app-lock-unavailable" variant="caption">
          This phone has no screen lock. Set a PIN, pattern or password in the phone's settings to use App lock.
        </AppText>
      ) : null}

      {settings.enabled ? (
        <View accessibilityLabel="Lock again after leaving CogVest" accessibilityRole="radiogroup">
          <AppText color="secondary" variant="caption">Lock again after leaving CogVest</AppText>
          {appLockRelockOptions.map((seconds) => {
            const selected = settings.relockAfterSeconds === seconds;
            return (
              <Pressable
                accessibilityLabel={`Lock again ${relockLabel(seconds).toLowerCase()}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={seconds}
                onPress={() => {
                  try {
                    setRelockAfter(seconds);
                    setMessage(undefined);
                  } catch {
                    setMessage("The App lock setting could not be saved. Try again.");
                  }
                }}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                testID={`app-lock-relock-${seconds}`}
              >
                <AppText style={styles.optionLabel}>{relockLabel(seconds)}</AppText>
                <Ionicons
                  accessible={false}
                  color={selected ? colors.primary : colors.text.secondary}
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={24}
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {message ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: colors.loss }} testID="app-lock-message" variant="caption">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  disabled: { opacity: 0.6 },
  group: { gap: spacing.xs },
  option: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: interaction.minimumTouchTarget,
    paddingVertical: spacing.sm,
  },
  optionLabel: { flex: 1 },
  pressed: { opacity: interaction.pressedOpacity },
  switchOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  switchThumb: { backgroundColor: colors.text.primary, borderRadius: 9, height: 18, width: 18 },
  switchThumbOn: { alignSelf: "flex-end", backgroundColor: colors.text.inverse },
  switchTrack: {
    backgroundColor: colors.surface.elevated,
    borderColor: colors.border.strong,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: "center",
    padding: 3,
    width: 44,
  },
  toggleCopy: { flex: 1, gap: spacing.xs },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
  },
}));
