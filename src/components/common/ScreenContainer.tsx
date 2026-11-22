import type { ReactElement, ReactNode, Ref } from "react";
import {
  type RefreshControlProps,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { spacing, createThemedStyles } from "@/src/theme";

import { FadeInView } from "./Motion";

type ScreenContainerProps = {
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  scroll?: boolean;
  scrollRef?: Ref<ScrollViewInstance>;
  testID?: string;
};

export function ScreenContainer({
  children,
  refreshControl,
  scroll = false,
  scrollRef,
  testID,
}: ScreenContainerProps) {
  const styles = useStyles();
  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} testID={testID}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          ref={scrollRef}
          refreshControl={refreshControl}
          style={styles.scroll}
        >
          <FadeInView kind="entry" style={styles.entry}>{children}</FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <FadeInView kind="entry" style={styles.content}>{children}</FadeInView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  // Screen entry fades the content in (#783); it keeps the scroll content's growth.
  entry: { flexGrow: 1 },
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
}));
