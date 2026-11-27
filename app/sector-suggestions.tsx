import { router } from "expo-router";
import { SectorSuggestionsScreen } from "@/src/features/holdings/SectorSuggestionsScreen";
import { useFocusedBackHandler } from "@/src/hooks";

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)/holdings");
}
export default function SectorSuggestionsRoute() {
  useFocusedBackHandler(close);
  return <SectorSuggestionsScreen onClose={close} />;
}
