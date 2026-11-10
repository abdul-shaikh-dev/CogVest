jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  const Ionicons = ({ name }: { name: string }) =>
    React.createElement(Text, { accessibilityElementsHidden: true }, name);
  Ionicons.loadFont = jest.fn(() => Promise.resolve());

  return { Ionicons };
});

// Chart gesture reactions run on the UI thread; tests only need their JS-side shape.
jest.mock("react-native-reanimated", () => ({
  useAnimatedReaction: jest.fn(),
  useDerivedValue: (compute: () => unknown) => ({ value: compute() }),
  useSharedValue: <T,>(value: T) => ({ value }),
}));
jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));

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
    useChartPressState: () => ({
      isActive: false,
      state: {
        isActive: shared(false),
        matchedIndex: shared(-1),
        x: { position: shared(0), value: shared(0) },
        y: { value: { position: shared(0), value: shared(0) } },
        yIndex: shared(0),
      },
    }),
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
