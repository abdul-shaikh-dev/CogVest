import type { ReactNode } from "react";
import type { ReactElement } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/src/theme";

type ScreenContainerProps = {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  scroll?: boolean;
  testID?: string;
};

export function ScreenContainer({
  children,
  refreshControl,
  scroll = false,
  testID,
}: ScreenContainerProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} testID={testID}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          refreshControl={refreshControl}
          style={styles.scroll}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
  },
  safe: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.screenHorizontal,
  },
});
