import { useRouter } from "expo-router";

import { ReviewSnapshotScreen } from "@/src/features/progress";

export default function ReviewSnapshotRoute() {
  const router = useRouter();

  return (
    <ReviewSnapshotScreen
      onCancel={() => router.back()}
      onComplete={() => router.back()}
    />
  );
}
