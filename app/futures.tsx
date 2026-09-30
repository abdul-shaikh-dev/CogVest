import { router } from "expo-router";
import { FuturesScreen } from "@/src/features/futures/FuturesScreen";

export default function FuturesRoute() {
  return <FuturesScreen onBack={() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings");
  }} />;
}
