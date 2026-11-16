import { router, useLocalSearchParams } from "expo-router";
import { InsightDetailScreen } from "@/src/features/insights";
import { useFocusedBackHandler } from "@/src/hooks";

function closeInsight() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/dashboard");
}

export default function InsightRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string | string[] }>();
  useFocusedBackHandler(closeInsight);
  return (
    <InsightDetailScreen
      key={typeof kind === "string" ? kind : "invalid"}
      kind={typeof kind === "string" ? kind : ""}
      onClose={closeInsight}
    />
  );
}
