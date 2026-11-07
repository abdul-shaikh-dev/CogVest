import type { ElementType } from "react";
import type { RenderResult } from "@testing-library/react-native";

/**
 * Test-only lookup of rendered React components by type or props.
 *
 * React Native Testing Library 14 renders through Test Renderer, which exposes
 * host elements only, and it removed the UNSAFE_*ByType and UNSAFE_*ByProps
 * queries. A few tests assert props that exist only on a composite component,
 * such as the `android_ripple` given to Pressable or the props given to an
 * expo-router mock. This walks React's fiber tree through Test Renderer's
 * `unstable_fiber` to read those props. Prefer host queries (`getByTestId`,
 * `getByRole`) for new tests.
 */
export type RenderedComponent = { props: Record<string, any>; type: unknown };

type Fiber = {
  child: Fiber | null;
  memoizedProps: Record<string, any> | null;
  return: Fiber | null;
  sibling: Fiber | null;
  type: unknown;
};

function rootFiber(screen: Pick<RenderResult, "container">): Fiber | null {
  const host = screen.container.children.find((child) => typeof child !== "string");
  let fiber = (host && typeof host !== "string" ? host.unstable_fiber : null) as Fiber | null;
  while (fiber?.return) fiber = fiber.return;
  return fiber;
}

export function queryAllComponents(
  screen: Pick<RenderResult, "container">,
  predicate: (component: RenderedComponent) => boolean,
): RenderedComponent[] {
  const found: RenderedComponent[] = [];
  const stack: Fiber[] = [];
  const top = rootFiber(screen);
  if (top) stack.push(top);
  while (stack.length > 0) {
    const fiber = stack.pop()!;
    const props = fiber.memoizedProps;
    if (fiber.type && props && typeof props === "object") {
      const component = { props, type: fiber.type };
      if (predicate(component)) found.push(component);
    }
    // Visit the first child before its siblings to keep render order.
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return found;
}

export function getAllByComponentType(screen: Pick<RenderResult, "container">, type: ElementType | string) {
  const found = queryAllComponents(screen, (component) => component.type === type);
  if (found.length === 0) throw new Error(`No rendered component of type ${describeType(type)}.`);
  return found;
}

export function getByComponentType(screen: Pick<RenderResult, "container">, type: ElementType | string) {
  const found = getAllByComponentType(screen, type);
  if (found.length > 1) throw new Error(`Found ${found.length} components of type ${describeType(type)}; expected one.`);
  return found[0];
}

export function queryByComponentType(screen: Pick<RenderResult, "container">, type: ElementType | string) {
  const found = queryAllComponents(screen, (component) => component.type === type);
  if (found.length > 1) throw new Error(`Found ${found.length} components of type ${describeType(type)}; expected one.`);
  return found[0] ?? null;
}

function describeType(type: unknown) {
  if (typeof type === "string") return type;
  const named = type as { displayName?: string; name?: string } | null;
  return named?.displayName ?? named?.name ?? "unknown";
}

/**
 * The `onPress` of the outermost component with this testID. Calling it twice
 * inside one `act` reproduces two taps within a single frame, which awaited
 * `fireEvent.press` calls in RNTL 14 can no longer do.
 */
export function getPressHandler(screen: Pick<RenderResult, "container">, testID: string): () => unknown {
  const target = queryAllComponents(
    screen,
    (component) => component.props.testID === testID && typeof component.props.onPress === "function",
  )[0];
  if (!target) throw new Error(`No pressable component with testID ${testID}.`);
  return target.props.onPress;
}
