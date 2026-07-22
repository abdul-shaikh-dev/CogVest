import { router, useLocalSearchParams } from "expo-router";

import { ReviewAssetScreen } from "@/src/features/assets";

export default function ReviewAssetRoute() {
  const params = useLocalSearchParams<{ assetId?: string }>();

  return (
    <ReviewAssetScreen
      assetId={params.assetId ?? ""}
      onCancel={() => router.back()}
      onComplete={(statusMessage) => {
        router.replace({
          pathname: "/(tabs)/holdings",
          params: { statusMessage },
        });
      }}
    />
  );
}
