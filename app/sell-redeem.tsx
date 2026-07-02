import { router, useLocalSearchParams } from "expo-router";

import { SellRedeemScreen } from "@/src/features/sellRedeem";

export default function SellRedeemRoute() {
  const params = useLocalSearchParams<{ assetId?: string }>();

  return (
    <SellRedeemScreen
      assetId={params.assetId ?? ""}
      onSaved={() => {
        router.back();
      }}
    />
  );
}
