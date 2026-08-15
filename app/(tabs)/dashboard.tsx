import { router } from "expo-router";

import { DashboardScreen as DashboardFeatureScreen } from "@/src/features/dashboard";
import { useQuickSetupSession } from "@/src/features/quickSetup";

export default function DashboardScreen() {
  const quickSetup = useQuickSetupSession();

  return (
    <DashboardFeatureScreen
      onAddTrade={() => {
        router.push("/add-holding");
      }}
      onOpenHoldings={() => {
        router.navigate("/(tabs)/holdings");
      }}
      onOpenProgress={() => {
        router.navigate("/(tabs)/progress");
      }}
      onQuickSetup={() => {
        router.push("/quick-portfolio-setup");
      }}
      quickSetupSavedCount={quickSetup.session?.items.length ?? 0}
    />
  );
}
