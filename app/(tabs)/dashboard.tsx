import { router } from "expo-router";

import { DashboardScreen as DashboardFeatureScreen } from "@/src/features/dashboard";
import { useQuickSetupSession } from "@/src/features/quickSetup";

export default function DashboardScreen() {
  const quickSetup = useQuickSetupSession();

  return (
    <DashboardFeatureScreen
      onOpenInsight={(kind) => router.push({ pathname: "/insight", params: { kind } })}
      onSetBasis={() => router.push("/measurement-basis")}
      onAddTrade={() => {
        router.push("/add-holding");
      }}
      onOpenHoldings={() => {
        router.navigate("/(tabs)/holdings");
      }}
      onOpenEpf={() => {
        router.navigate({ pathname: "/(tabs)/holdings", params: { destination: "epf" } });
      }}
      onOpenProgress={() => {
        router.navigate("/(tabs)/progress");
      }}
      onQuickSetup={() => {
        router.navigate({ pathname: "/(tabs)/holdings", params: { openAddMenu: "true" } });
      }}
      quickSetupSavedCount={quickSetup.session?.items.length ?? 0}
    />
  );
}
