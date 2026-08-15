import { router, useLocalSearchParams } from "expo-router";

import { PpfAccountScreen } from "@/src/features/ppf";

export default function PpfAccountRoute() {
  const params = useLocalSearchParams<{
    accountId?: string;
    legacyAssetId?: string;
    legacyName?: string;
  }>();

  return (
    <PpfAccountScreen
      accountId={params.accountId}
      legacyAssetId={params.legacyAssetId}
      legacyName={params.legacyName}
      onBack={() => router.back()}
      onComplete={(accountId) =>
        router.replace({ pathname: "/ppf-account", params: { accountId } })
      }
      onEntry={(accountId, entryId) =>
        router.push({
          pathname: "/ppf-entry",
          params: { accountId, ...(entryId ? { entryId } : {}) },
        })
      }
    />
  );
}
