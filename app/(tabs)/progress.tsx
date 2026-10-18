import { router } from "expo-router";

import { ProgressScreen } from "@/src/features/progress";

export default function ProgressTabScreen() {
  return (
    <ProgressScreen
      onAddHolding={() => router.push("/add-holding")}
      onOpenEpf={(accountId) => {
        if (accountId) router.push({ pathname: "/epf-account", params: { accountId } });
        else router.navigate({ pathname: "/(tabs)/holdings", params: { destination: "epf" } });
      }}
      onOpenHoldings={() => router.navigate("/(tabs)/holdings")}
      onReviewSnapshot={() => router.push("/review-snapshot")}
      onSetUpPortfolio={() => router.push("/quick-portfolio-setup")}
    />
  );
}
