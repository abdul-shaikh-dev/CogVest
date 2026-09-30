import { router, useLocalSearchParams } from "expo-router";
import { RecordPurchaseScreen } from "@/src/features/trades/RecordPurchaseScreen";

export default function RecordPurchaseRoute() {
  const { assetId } = useLocalSearchParams<{ assetId?: string }>();
  return <RecordPurchaseScreen initialAssetId={assetId}
    onCancel={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/holdings")}
    onSaved={() => router.replace({ pathname: "/(tabs)/holdings", params: { statusMessage: "Purchase recorded." } })} />;
}
