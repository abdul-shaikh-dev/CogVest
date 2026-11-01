import "react-native-gesture-handler";
// Opt-in local QA APK only; ordinary preview/production builds do not start it.
if (process.env.EXPO_PUBLIC_COGVEST_PERFORMANCE_PROBE === "1") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only in the opt-in probe build.
  require("./src/testing/performanceProbe").startPerformanceProbe();
}
// eslint-disable-next-line import/first -- the probe must start before the router entry loads.
import "expo-router/entry";
