import { Modal, Pressable, StyleSheet, View } from "react-native";

import { AppButton, AppText, SectionHeader } from "@/src/components/common";

import { useStyles } from "./addHoldingStyles";

/** Confirms leaving Add Holding or portfolio setup with unsaved details. */
export function HoldingExitConfirmation({
  isExitConfirmationVisible,
  onCancel,
  quickSetup,
  setIsExitConfirmationVisible,
}: {
  isExitConfirmationVisible: boolean;
  onCancel?: () => void;
  quickSetup: boolean;
  setIsExitConfirmationVisible: (visible: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <Modal
      testID="holding-exit-confirmation"
      animationType="fade"
      onRequestClose={() => setIsExitConfirmationVisible(false)}
      transparent
      visible={isExitConfirmationVisible}
    >
      <View style={styles.exitBackdrop}>
        <Pressable
          accessibilityLabel={quickSetup ? "Keep editing portfolio setup" : "Keep editing holding"}
          accessibilityRole="button"
          onPress={() => setIsExitConfirmationVisible(false)}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.exitSheet}>
          <SectionHeader title={quickSetup ? "Leave portfolio setup?" : "Discard unfinished holding?"} />
          <AppText color="secondary">
            {quickSetup
              ? "Confirmed holdings are already saved. Unfinished details on this screen will be discarded."
              : "This holding has not been saved. Leaving will discard your unfinished details."}
          </AppText>
          <AppButton
            onPress={() => setIsExitConfirmationVisible(false)}
            testID={quickSetup ? "quick-setup-keep-editing" : "holding-keep-editing"}
            title="Keep editing"
          />
          <AppButton
            onPress={() => {
              setIsExitConfirmationVisible(false);
              onCancel?.();
            }}
            testID={quickSetup ? "quick-setup-confirm-exit" : "holding-discard-exit"}
            title={quickSetup ? "Leave setup" : "Discard and leave"}
            variant="secondary"
          />
        </View>
      </View>
    </Modal>
  );
}
