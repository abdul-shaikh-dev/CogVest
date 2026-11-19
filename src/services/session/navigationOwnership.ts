// During the font-size relaunch (#529) Android starts the new React surface
// before it stops the old one, so two navigation containers briefly share
// expo-router's single navigation ref. The new container takes the ref first;
// when the old one unmounts its cleanup sets the ref to null, which leaves
// every global router call (push, back, reset) silently doing nothing for the
// rest of the session. The newest mount owns the ref with the container it
// lives in: it fills the ref if the old surface already emptied it, and an
// older mount that goes away later hands the ref back to the newest container.

export type NavigationRefLike<T> = { current: T | null };

export type NavigationOwnership = {
  /**
   * Records the container this mount lives in (falling back to the ref's
   * current value) and fills an empty ref with it; returns this mount's id.
   */
  claim: <T>(ref: NavigationRefLike<T>, container?: T | null) => number;
  isOwner: (id: number) => boolean;
  /** Called when a mount goes away; repairs the ref for a newer owner. */
  release: <T>(id: number, ref: NavigationRefLike<T>) => void;
};

export function createNavigationOwnership(): NavigationOwnership {
  let latestId = 0;
  let latestContainer: unknown = null;

  return {
    claim: (ref, container) => {
      latestId += 1;
      latestContainer = container ?? ref.current;
      if (ref.current == null && latestContainer != null) ref.current = latestContainer as never;
      return latestId;
    },
    isOwner: (id) => id === latestId,
    release: (id, ref) => {
      if (id === latestId || ref.current != null || latestContainer == null) return;
      ref.current = latestContainer as never;
    },
  };
}

export const navigationOwnership = createNavigationOwnership();
