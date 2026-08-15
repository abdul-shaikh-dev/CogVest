import { router, useLocalSearchParams } from "expo-router";

import { PpfAccountScreen } from "@/src/features/ppf";
import { getQuickSetupSessionStore } from "@/src/features/quickSetup";
import { getPortfolioStore } from "@/src/store";

export default function PpfAccountRoute() {
  const params = useLocalSearchParams<{
    accountId?: string;
    legacyAssetId?: string;
    legacyName?: string;
    returnTo?: "quick-portfolio-setup";
  }>();

  return (
    <PpfAccountScreen
      accountId={params.accountId}
      legacyAssetId={params.legacyAssetId}
      legacyName={params.legacyName}
      onBack={() => router.back()}
      onComplete={(accountId) => {
        if (params.returnTo === "quick-portfolio-setup") {
          const account = getPortfolioStore()
            .getState()
            .ppfAccounts.find((candidate) => candidate.id === accountId);

          if (account) {
            getQuickSetupSessionStore().getState().recordItem({
              kind: "ppfAccount",
              name: account.nickname,
              recordId: account.id,
            });
          }

          router.back();
          return;
        }

        router.replace({ pathname: "/ppf-account", params: { accountId } });
      }}
      onEntry={(accountId, entryId) =>
        router.push({
          pathname: "/ppf-entry",
          params: { accountId, ...(entryId ? { entryId } : {}) },
        })
      }
    />
  );
}
