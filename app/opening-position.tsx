import { router, useLocalSearchParams } from "expo-router";

import { ReviewOpeningPositionScreen } from "@/src/features/openingPositions";

export default function OpeningPositionRoute() {
  const params = useLocalSearchParams<{ openingPositionId?: string }>();

  return (
    <ReviewOpeningPositionScreen
      openingPositionId={params.openingPositionId ?? ""}
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
