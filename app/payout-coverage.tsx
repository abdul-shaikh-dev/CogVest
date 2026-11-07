import { router } from "expo-router";

import { PayoutCoverageScreen } from "@/src/features/payouts";

export default function PayoutCoverageRoute() {
  return (
    <PayoutCoverageScreen
      onBack={() => router.back()}
      onReviewHolding={(assetId) => router.push({ pathname: "/payouts", params: { assetId } })}
    />
  );
}
