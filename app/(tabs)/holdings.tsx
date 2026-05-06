import { router } from "expo-router";

import { HoldingsScreen as HoldingsFeatureScreen } from "@/src/features/holdings";

export default function HoldingsScreen() {
  return (
    <HoldingsFeatureScreen
      onAddTrade={() => {
        router.push("/add-holding");
      }}
    />
  );
}
