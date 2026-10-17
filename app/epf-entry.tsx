import { router, useLocalSearchParams } from "expo-router";

import { EpfEntryScreen } from "@/src/features/epf";

export default function EpfEntryRoute() {
  const params = useLocalSearchParams<{ accountId: string; entryId?: string }>();

  return (
    <EpfEntryScreen
      accountId={params.accountId}
      entryId={params.entryId}
      onBack={() => router.back()}
      onComplete={() => router.back()}
    />
  );
}
