import { router, useLocalSearchParams } from "expo-router";

import { EpfAccountScreen } from "@/src/features/epf";

export default function EpfAccountRoute() {
  const params = useLocalSearchParams<{ accountId?: string }>();

  return (
    <EpfAccountScreen
      key={params.accountId ?? "new"}
      accountId={params.accountId}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: "/(tabs)/holdings", params: { destination: "epf" } });
      }}
      onComplete={(accountId) => router.replace({ pathname: "/epf-account", params: { accountId } })}
      onUpdateBalance={(accountId) => router.push({ pathname: "/epf-update", params: { accountId } })}
      onOpenEntry={(accountId, entryId) => router.push({ pathname: "/epf-entry", params: { accountId, ...(entryId ? { entryId } : {}) } })}
    />
  );
}
