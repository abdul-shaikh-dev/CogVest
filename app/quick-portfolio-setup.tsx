import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { QuickPortfolioSetupScreen } from "@/src/features/quickSetup";

export default function QuickPortfolioSetupRoute() {
  const [isFocused, setIsFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  return (
    <QuickPortfolioSetupScreen
      hardwareBackEnabled={isFocused}
      onAddPpfAccount={() =>
        router.push({
          pathname: "/ppf-account",
          params: { returnTo: "quick-portfolio-setup" },
        })
      }
      onComplete={() => router.replace("/(tabs)/dashboard")}
      onExit={() => router.back()}
    />
  );
}
