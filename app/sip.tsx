import { router, useLocalSearchParams } from "expo-router";

import { SipTemplateScreen } from "@/src/features/sips";

export default function SipRoute() {
  const params = useLocalSearchParams<{ templateId?: string }>();

  return (
    <SipTemplateScreen
      key={params.templateId ?? "new"}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/settings");
      }}
      templateId={params.templateId}
    />
  );
}
