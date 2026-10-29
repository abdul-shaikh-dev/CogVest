import { router } from "expo-router";

import { MeasurementBasisScreen } from "@/src/features/wholePortfolio";

export default function MeasurementBasisRoute() {
  return <MeasurementBasisScreen onBack={() => router.back()} />;
}
