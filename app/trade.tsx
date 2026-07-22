import { router, useLocalSearchParams } from "expo-router";

import { ReviewTradeScreen } from "@/src/features/trades";

export default function TradeRoute() {
  const params = useLocalSearchParams<{ tradeId?: string }>();

  return (
    <ReviewTradeScreen
      tradeId={params.tradeId ?? ""}
      onCancel={() => router.back()}
      onComplete={(statusMessage) =>
        router.replace({
          pathname: "/(tabs)/holdings",
          params: { statusMessage },
        })
      }
    />
  );
}
