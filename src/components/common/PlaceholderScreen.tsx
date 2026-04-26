import { StyleSheet, View } from "react-native";

import { colors, spacing } from "@/src/theme";

import { AppText } from "./AppText";
import { ScreenContainer } from "./ScreenContainer";

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <AppText variant="hero" weight="bold">
          {title}
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
});
