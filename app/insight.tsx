import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";
import { InsightDetailScreen } from "@/src/features/insights";

function closeInsight() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/dashboard");
}

export default function InsightRoute() {
  const { kind } = useLocalSearchParams<{ kind?: string | string[] }>();
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener("hardwareBackPress", () => {
        closeInsight();
        return true;
      });
      return () => listener.remove();
    }, []),
  );
  return (
    <InsightDetailScreen
      key={typeof kind === "string" ? kind : "invalid"}
      kind={typeof kind === "string" ? kind : ""}
      onClose={closeInsight}
    />
  );
}
