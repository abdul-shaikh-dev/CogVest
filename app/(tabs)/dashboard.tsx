import { router } from "expo-router";

import { DashboardScreen as DashboardFeatureScreen } from "@/src/features/dashboard";

export default function DashboardScreen() {
  return (
    <DashboardFeatureScreen
      onAddTrade={() => {
        router.push("/(tabs)/add-trade");
      }}
    />
  );
}
