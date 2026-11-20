import { createNavigationOwnership, type NavigationGlobals } from "../navigationOwnership";

const unbound = () => {
  throw new Error("The imperative router is unavailable before the first render has finished.");
};

function createGlobals() {
  const ref: { current: unknown } = { current: null };
  const router: { push: (href: string) => string } = { push: unbound };
  return { globals: { ref, router } as NavigationGlobals & { ref: typeof ref; router: typeof router }, ref, router };
}

describe("navigation ownership (#529)", () => {
  it("hands the ref and router back to the newer mount when the older one goes away", () => {
    const ownership = createNavigationOwnership();
    const { globals, ref, router } = createGlobals();
    const oldRouter = { push: (href: string) => `old ${href}` };
    const newRouter = { push: (href: string) => `new ${href}` };

    ref.current = "old container";
    const oldMount = ownership.claim(globals, { container: "old container", router: oldRouter });
    ref.current = "new container";
    const newMount = ownership.claim(globals, { container: "new container", router: newRouter });
    expect(ownership.isOwner(oldMount)).toBe(false);
    expect(ownership.isOwner(newMount)).toBe(true);

    // The old tree's cleanup empties the shared ref and unbinds the router.
    ref.current = null;
    router.push = unbound;
    ownership.release(oldMount, globals);

    expect(ref.current).toBe("new container");
    expect(router.push("/backup")).toBe("new /backup");
  });

  it("rebinds the ref and router the old tree already cleared when the new mount arrives late", () => {
    const ownership = createNavigationOwnership();
    const { globals, ref, router } = createGlobals();
    ref.current = "old container";
    const oldMount = ownership.claim(globals, {
      container: "old container",
      router: { push: (href: string) => `old ${href}` },
    });

    // The old tree unmounted before this mount rendered (e.g. fonts still loading).
    ref.current = null;
    router.push = unbound;
    ownership.release(oldMount, globals);
    expect(ref.current).toBeNull();

    ownership.claim(globals, {
      container: "new container",
      router: { push: (href: string) => `new ${href}` },
    });
    expect(ref.current).toBe("new container");
    expect(router.push("/backup")).toBe("new /backup");
  });

  it("leaves a ref that is still set alone", () => {
    const ownership = createNavigationOwnership();
    const { globals, ref } = createGlobals();
    const oldMount = ownership.claim(globals, { container: "old container" });
    ownership.claim(globals, { container: "new container" });

    ref.current = "current container";
    ownership.release(oldMount, globals);
    expect(ref.current).toBe("current container");
  });

  it("does not revive the globals when the only mount goes away", () => {
    const ownership = createNavigationOwnership();
    const { globals, ref, router } = createGlobals();
    const only = ownership.claim(globals, { container: "container", router: { push: () => "bound" } });

    ref.current = null;
    router.push = unbound;
    ownership.release(only, globals);
    expect(ref.current).toBeNull();
    expect(() => router.push("/backup")).toThrow("imperative router is unavailable");
  });
});
