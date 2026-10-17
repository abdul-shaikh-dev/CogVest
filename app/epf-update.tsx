import { router, useLocalSearchParams } from "expo-router";

import { EpfBalanceUpdateScreen } from "@/src/features/epf";

export default function EpfUpdateRoute() {
  const params = useLocalSearchParams<{ accountId: string }>();

  return (
    <EpfBalanceUpdateScreen
      accountId={params.accountId}
      onBack={() => router.back()}
      onComplete={() => router.back()}
    />
  );
}
