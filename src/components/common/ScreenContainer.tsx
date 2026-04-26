import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";

import { colors, spacing } from "@/src/theme";

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  testID?: string;
};

export function ScreenContainer({
  children,
  scroll = false,
  testID,
}: ScreenContainerProps) {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} testID={testID}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
    paddingHorizontal: spacing.screenHorizontal,
  },
});
