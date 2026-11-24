import { router } from "expo-router";

import { AllocationTargetsScreen } from "@/src/features/allocationTargets";

export default function AllocationTargetsRoute() {
  return (
    <AllocationTargetsScreen
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/settings");
      }}
    />
  );
}
