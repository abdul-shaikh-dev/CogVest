import { router, useLocalSearchParams } from "expo-router";

import { TradeHistoryScreen } from "@/src/features/trades";

export default function HoldingTransactionsRoute() {
  const params = useLocalSearchParams<{ assetId?: string }>();

  return (
    <TradeHistoryScreen
      assetId={params.assetId ?? ""}
      onBack={() => router.back()}
      onReviewTrade={(tradeId) =>
        router.push({ pathname: "/trade", params: { tradeId } })
      }
    />
  );
}
