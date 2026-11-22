import { createContext, useContext, useEffect, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type DimensionValue,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as SafeArea from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { createThemedStyles, getMotionDuration, radii, spacing } from "@/src/theme";

// Read insets without requiring a provider: a sheet can open in a screen
// rendered on its own, where zero is the right inset.
const InsetsContext = SafeArea.SafeAreaInsetsContext ?? createContext<SafeArea.EdgeInsets | null>(null);

/** How far, in dp, a drag must pull the sheet down before it asks to close. */
export const SHEET_CLOSE_DISTANCE = 96;
/** A fast flick closes it from a shorter drag. */
export const SHEET_CLOSE_VELOCITY = 900;

/** Whether a finished drag should ask the sheet to close. */
export function shouldCloseSheet(translationY: number, velocityY: number) {
  "worklet";
  return translationY > SHEET_CLOSE_DISTANCE || (translationY > 24 && velocityY > SHEET_CLOSE_VELOCITY);
}

type BottomSheetProps = {
  /** Read to screen readers on the scrim and the drag handle. */
  closeLabel: string;
  children: ReactNode;
  /** Off while saving, so the task cannot be closed halfway. */
  dismissible?: boolean;
  /** Back, a scrim tap and a drag down all call this. Keep any unsaved-change guard here. */
  onRequestClose: () => void;
  maxHeight?: DimensionValue;
  /** testID on the Modal itself, for tests that send it a request to close. */
  modalTestID?: string;
  /** Wrap the content in a ScrollView (default). Turn off when the child scrolls itself. */
  scroll?: boolean;
  testID?: string;
  visible: boolean;
};

/**
 * The shared bottom sheet for short tasks (#784). It slides up, closes with
 * Back, a scrim tap or a drag down, and leaves the decision to close to its
 * caller, so a "Discard changes?" guard keeps working.
 */
export function BottomSheet(props: BottomSheetProps) {
  // Mount the modal and its gesture only while open: a form can hold many
  // closed pickers.
  return props.visible ? <OpenBottomSheet {...props} /> : null;
}

function OpenBottomSheet({
  children,
  closeLabel,
  dismissible = true,
  maxHeight = "90%",
  modalTestID,
  onRequestClose,
  scroll = true,
  testID = "bottom-sheet",
  visible,
}: BottomSheetProps) {
  const styles = useStyles();
  const bottomInset = useContext(InsetsContext)?.bottom ?? 0;
  const { height: windowHeight } = useWindowDimensions();
  const duration = getMotionDuration("sheet", useReducedMotion());
  const offset = useSharedValue(windowHeight);

  useEffect(() => {
    offset.set(duration === null ? 0 : withTiming(0, { duration, easing: Easing.out(Easing.cubic) }));
  }, [duration, offset]);

  const requestClose = () => {
    if (dismissible) onRequestClose();
  };

  const drag = Gesture.Pan()
    .enabled(dismissible)
    .activeOffsetY(8)
    .failOffsetY(-8)
    .onUpdate((event) => {
      offset.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (shouldCloseSheet(event.translationY, event.velocityY)) scheduleOnRN(onRequestClose);
      // Settle back: if the caller closes the sheet it unmounts; if a guard
      // keeps it open, it is back in place under the guard's dialog.
      offset.set(duration === null ? 0 : withTiming(0, { duration }));
    });

  // The modal window does not resize for the keyboard, so the sheet grows by
  // the keyboard's height: fields and the save action stay reachable.
  const keyboard = useAnimatedKeyboard({ isStatusBarTranslucentAndroid: true });
  const bottomPadding = Math.max(bottomInset, spacing.md);
  const sheetMotion = useAnimatedStyle(() => ({
    paddingBottom: Math.max(bottomPadding, keyboard.height.get()),
    transform: [{ translateY: offset.get() }],
  }));

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
      testID={modalTestID}
      transparent
      visible={visible}
    >
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop} testID={`${testID}-backdrop`}>
          <Pressable
            accessibilityLabel={closeLabel}
            accessibilityRole="button"
            onPress={requestClose}
            style={StyleSheet.absoluteFill}
            testID={`${testID}-scrim`}
          />
          <Animated.View
            accessibilityViewIsModal
            style={[styles.sheet, { maxHeight }, sheetMotion]}
            testID={testID}
          >
            <GestureDetector gesture={drag}>
              <View style={styles.handleArea}>
                <Pressable
                  accessibilityHint="Drag down or double-tap to close"
                  accessibilityLabel={closeLabel}
                  accessibilityRole="button"
                  hitSlop={12}
                  onPress={requestClose}
                  style={styles.handleTarget}
                  testID={`${testID}-handle`}
                >
                  <View style={styles.handle} />
                </Pressable>
              </View>
            </GestureDetector>
            {content}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  backdrop: {
    backgroundColor: colors.scrim,
    flex: 1,
    justifyContent: "flex-end",
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  fill: { flexShrink: 1 },
  handle: {
    backgroundColor: colors.text.secondary,
    borderRadius: radii.pill,
    height: 4,
    opacity: 0.4,
    width: 32,
  },
  handleArea: {
    alignItems: "center",
  },
  handleTarget: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    minWidth: 64,
  },
  root: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    gap: spacing.sm,
  },
}));
