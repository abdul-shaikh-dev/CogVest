jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  const Ionicons = ({ name }: { name: string }) =>
    React.createElement(Text, { accessibilityElementsHidden: true }, name);
  Ionicons.loadFont = jest.fn(() => Promise.resolve());

  return { Ionicons };
});

// Chart gesture reactions run on the UI thread. These mocks run them on the
// JS thread instead, registered with src/testing/chartPress.ts so a test can
// drive a press with pressChartAt (#673).
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { registerMockReaction } = require("./src/testing/chartPress");

  function useAnimatedReaction(prepare: () => unknown, react: (value: unknown, previous: unknown) => void) {
    const handle = React.useRef(null);
    handle.current?.update({ prepare, react });
    React.useEffect(() => {
      handle.current = registerMockReaction({ prepare, react });
      return () => handle.current.remove();
    // The handle tracks later closures through update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  }

  // Layout animations (#783): a builder that records its duration, so a test
  // can tell whether a fade was requested.
  const { Text, View } = require("react-native");
  const fade = (duration?: number) => ({
    duration: (value: number) => fade(value),
    easing: () => fade(duration),
    reduceMotion: () => fade(duration),
    mockDuration: duration,
  });
  const Animated = { createAnimatedComponent: (component: unknown) => component, Text, View };

  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    Easing: {
      cubic: (value: number) => value,
      inOut: (easing: unknown) => easing,
      out: (easing: unknown) => easing,
      quad: (value: number) => value,
    },
    cancelAnimation: jest.fn(),
    FadeIn: fade(),
    ReduceMotion: { System: "system" },
    useReducedMotion: jest.fn(() => false),
    // Bottom sheet motion (#784): styles compute once, timings land at once.
    useAnimatedStyle: (style: () => unknown) => style(),
    withTiming: jest.fn(<T,>(value: T) => value),
    // Press springs and the refresh indicator (#785) land at once.
    withRepeat: jest.fn(<T,>(value: T) => value),
    withSpring: jest.fn(<T,>(value: T) => value),
    useAnimatedReaction,
    useDerivedValue: (compute: () => unknown) => ({ value: compute() }),
    useSharedValue: <T,>(value: T) => {
      const shared = { value, get: () => shared.value, set: (next: T) => { shared.value = next; } };
      return shared;
    },
  };
});
// The bottom sheet's drag (#784) runs on the UI thread. Jest renders the
// detector's child; shouldCloseSheet covers the drag decision.
jest.mock("react-native-gesture-handler", () => ({
  ...jest.requireActual("react-native-gesture-handler"),
  GestureDetector: ({ children }: { children: unknown }) => children,
}));
jest.mock("react-native-worklets", () => ({
  scheduleOnRN: (callback: (...args: unknown[]) => void, ...args: unknown[]) => callback(...args),
}));

// Skia draws on a native canvas; Jest checks the props CogVest passes instead.
jest.mock("@shopify/react-native-skia", () => {
  const React = require("react");
  const { View } = require("react-native");
  const element = (name: string) => (props: Record<string, unknown>) =>
    React.createElement(View, { ...props, testID: `skia-${name}` });

  return {
    Circle: element("circle"),
    DashPathEffect: element("dash"),
    Line: element("line"),
    LinearGradient: element("gradient"),
    matchFont: jest.fn(() => ({})),
    vec: (x: number, y: number) => ({ x, y }),
  };
});

// Victory renders through Skia; this keeps its props and the points it would
// hand to children (one array per y key, x as the row index) inspectable.
jest.mock("victory-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  const shared = <T,>(value: T) => ({ value });
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const scale = Object.assign((value: number) => value, { invert: (value: number) => value });

  function CartesianChart({
    children,
    data,
    onScaleChange,
    yKeys,
    ...props
  }: {
    children: (args: unknown) => unknown;
    data: Array<Record<string, number>>;
    onScaleChange?: (x: typeof scale, y: typeof scale) => void;
    yKeys: string[];
  } & Record<string, unknown>) {
    React.useEffect(() => onScaleChange?.(scale, scale), [onScaleChange]);
    const points = Object.fromEntries(yKeys.map((key) => [
      key,
      data.map((datum, index) => ({ x: index, xValue: datum.x, y: datum[key], yValue: datum[key] })),
    ]));
    return React.createElement(
      View,
      { ...props, data, testID: "victory-cartesian-chart", yKeys },
      children({ chartBounds: { bottom: 200, left: 0, right: 300, top: 0 }, points, xScale: scale, yScale: scale }),
    );
  }

  return {
    Area: (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: "victory-area" }),
    CartesianChart,
    Line: (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: "victory-line" }),
    getTransformComponents: () => ({ scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 }),
    useChartPressState: (init: { x: number; y: Record<string, number> }) => {
      const { createMockChartPressState, registerMockChart } = require("./src/testing/chartPress");
      const [, rerender] = React.useReducer((count: number) => count + 1, 0);
      const state = React.useRef(null);
      state.current ??= createMockChartPressState(init);
      React.useEffect(() => registerMockChart({ rerender, state: state.current }), [registerMockChart]);
      return { isActive: state.current.isActive.value, state: state.current };
    },
    useChartTransformState: () => ({
      state: {
        matrix: shared(identity),
        offset: shared(identity),
        origin: shared({ x: 0, y: 0 }),
        panActive: shared(false),
        zoomActive: shared(false),
      },
    }),
  };
});

// Session memory deliberately outlives React remounts (#529); keep each test
// independent of input an earlier test left behind.
afterEach(() => {
  require("./src/services/session").sessionMemory.forgetAll();
});
