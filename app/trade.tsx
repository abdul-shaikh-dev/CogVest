import { router, useLocalSearchParams } from "expo-router";

import { ReviewTradeScreen } from "@/src/features/trades";

export default function TradeRoute() {
  const params = useLocalSearchParams<{ returnTo?: "cash"; tradeId?: string }>();
  const returnsToCash = params.returnTo === "cash";

  return (
    <ReviewTradeScreen
      backLabel={returnsToCash ? "Back to Cash" : "Back to Holdings"}
      tradeId={params.tradeId ?? ""}
      onCancel={() => returnsToCash ? router.dismissTo("/(tabs)/cash") : router.back()}
      onComplete={(status) =>
        returnsToCash
          ? router.dismissTo("/(tabs)/cash")
          : router.dismissTo({
              pathname: "/(tabs)/holdings",
              params: { status },
            })
      }
    />
  );
}
