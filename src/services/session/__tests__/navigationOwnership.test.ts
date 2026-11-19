import { createNavigationOwnership } from "../navigationOwnership";

describe("navigation ownership (#529)", () => {
  it("hands the ref back to the newer container when the older mount goes away", () => {
    const ownership = createNavigationOwnership();
    const ref: { current: string | null } = { current: "old container" };
    const oldMount = ownership.claim(ref);

    ref.current = "new container";
    const newMount = ownership.claim(ref);
    expect(ownership.isOwner(oldMount)).toBe(false);
    expect(ownership.isOwner(newMount)).toBe(true);

    // The old container's cleanup clears the shared ref after the new one set it.
    ref.current = null;
    ownership.release(oldMount, ref);
    expect(ref.current).toBe("new container");
  });

  it("leaves a ref that is still set alone", () => {
    const ownership = createNavigationOwnership();
    const ref: { current: string | null } = { current: "old container" };
    const oldMount = ownership.claim(ref);
    ref.current = "new container";
    ownership.claim(ref);

    const assigned = jest.fn();
    const watched = {
      get current() { return "new container"; },
      set current(value: string | null) { assigned(value); },
    };
    ownership.release(oldMount, watched);
    expect(assigned).not.toHaveBeenCalled();
  });

  it("does not revive the ref when the only mount goes away", () => {
    const ownership = createNavigationOwnership();
    const ref: { current: string | null } = { current: "container" };
    const only = ownership.claim(ref);
    ref.current = null;
    ownership.release(only, ref);
    expect(ref.current).toBeNull();
  });
});
