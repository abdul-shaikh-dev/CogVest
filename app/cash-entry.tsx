import { router, useLocalSearchParams } from "expo-router";

import { ReviewCashEntryScreen } from "@/src/features/cash";

export default function CashEntryRoute() {
  const params = useLocalSearchParams<{ entryId?: string }>();

  return (
    <ReviewCashEntryScreen
      entryId={params.entryId ?? ""}
      onCancel={() => router.back()}
      onComplete={() => router.back()}
    />
  );
}
