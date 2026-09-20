import { router, useLocalSearchParams } from "expo-router";

import { ReviewAssetScreen } from "@/src/features/assets";

export default function ReviewAssetRoute() {
  const params = useLocalSearchParams<{ assetId?: string; returnTo?: "manage-assets" }>();

  return (
    <ReviewAssetScreen
      assetId={params.assetId ?? ""}
      onCancel={() => router.back()}
      onComplete={(statusMessage) => {
        if (params.returnTo === "manage-assets") {
          router.back();
          return;
        }

        router.replace({
          pathname: "/(tabs)/holdings",
          params: { statusMessage },
        });
      }}
    />
  );
}
