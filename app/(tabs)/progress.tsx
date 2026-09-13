import { router } from "expo-router";

import { ProgressScreen } from "@/src/features/progress";

export default function ProgressTabScreen() {
  return (
    <ProgressScreen
      onOpenHoldings={() => router.navigate("/(tabs)/holdings")}
      onReviewSnapshot={() => router.push("/review-snapshot")}
      onSetUpPortfolio={() => router.push("/quick-portfolio-setup")}
    />
  );
}
