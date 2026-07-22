import { router } from "expo-router";

import { ManageAssetsScreen } from "@/src/features/assets";

export default function ManageAssetsRoute() {
  return (
    <ManageAssetsScreen
      onBack={() => router.replace("/(tabs)/holdings")}
      onReviewAsset={(assetId) => {
        router.push({ pathname: "/asset", params: { assetId } });
      }}
    />
  );
}
