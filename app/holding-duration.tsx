import { router } from "expo-router";
import { HoldingDurationScreen } from "@/src/features/holdings/HoldingDurationScreen";
import { useFocusedBackHandler } from "@/src/hooks";

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/holdings");
}
export default function HoldingDurationRoute() {
  useFocusedBackHandler(close);
  return <HoldingDurationScreen onClose={close} />;
}
