import { router } from "expo-router";

import { SipTemplatesScreen } from "@/src/features/sips";

export default function SipsRoute() {
  return (
    <SipTemplatesScreen
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/settings");
      }}
      onOpen={(templateId) => router.push(templateId ? { pathname: "/sip", params: { templateId } } : "/sip")}
    />
  );
}
