import { router, useLocalSearchParams } from "expo-router";

import { GoalScreen } from "@/src/features/goals";

export default function GoalRoute() {
  const params = useLocalSearchParams<{ goalId?: string }>();

  return (
    <GoalScreen
      goalId={params.goalId}
      key={params.goalId ?? "new"}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/progress");
      }}
    />
  );
}
