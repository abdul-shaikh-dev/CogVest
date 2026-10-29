import { router, useLocalSearchParams } from "expo-router";

import { PayoutsScreen } from "@/src/features/payouts";

export default function PayoutsRoute() {
  const params = useLocalSearchParams<{ assetId: string }>();

  return (
    <PayoutsScreen
      assetId={params.assetId}
      onAddPayout={() => router.push({ pathname: "/payout-entry", params: { assetId: params.assetId } })}
      onBack={() => router.back()}
      onReviewPayout={(distributionId) =>
        router.push({ pathname: "/payout-entry", params: { assetId: params.assetId, distributionId } })
      }
    />
  );
}
