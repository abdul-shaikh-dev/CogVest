import { router, useLocalSearchParams } from "expo-router";

import { PayoutEntryScreen } from "@/src/features/payouts";

export default function PayoutEntryRoute() {
  const params = useLocalSearchParams<{ assetId: string; distributionId?: string }>();

  return (
    <PayoutEntryScreen
      assetId={params.assetId}
      distributionId={params.distributionId}
      onBack={() => router.back()}
      onComplete={() => router.back()}
    />
  );
}
