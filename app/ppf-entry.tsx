import { router, useLocalSearchParams } from "expo-router";

import { PpfEntryScreen } from "@/src/features/ppf";

export default function PpfEntryRoute() {
  const params = useLocalSearchParams<{ accountId: string; entryId?: string }>();

  return (
    <PpfEntryScreen
      accountId={params.accountId}
      entryId={params.entryId}
      onBack={() => router.back()}
      onComplete={() =>
        router.replace({
          pathname: "/ppf-account",
          params: { accountId: params.accountId },
        })
      }
    />
  );
}
