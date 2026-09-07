import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";
import { HoldingDurationScreen } from "@/src/features/holdings/HoldingDurationScreen";

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/holdings");
}
export default function HoldingDurationRoute() {
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      return () => listener.remove();
    }, []),
  );
  return <HoldingDurationScreen onClose={close} />;
}
