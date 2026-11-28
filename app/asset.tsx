import { router, useLocalSearchParams } from "expo-router";

import { ReviewAssetScreen } from "@/src/features/assets";

export default function ReviewAssetRoute() {
  const params = useLocalSearchParams<{ assetId?: string; returnTo?: "manage-assets" | "sector-suggestions" }>();

  return (
    <ReviewAssetScreen
      assetId={params.assetId ?? ""}
      onCancel={() => router.back()}
      onComplete={(status) => {
        if (params.returnTo === "manage-assets" || params.returnTo === "sector-suggestions") {
          router.back();
          return;
        }

        router.replace({
          pathname: "/(tabs)/holdings",
          params: { status },
        });
      }}
    />
  );
}
