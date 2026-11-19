// During the font-size relaunch (#529) Android starts the new React surface
// before it stops the old one, so two app trees briefly share expo-router's
// global navigation ref and global `router`. Each tree binds them when it
// mounts and clears them when it unmounts, so the old tree's cleanup leaves
// them empty after the new tree has bound them: global router calls then do
// nothing or throw "The imperative router is unavailable" for the rest of the
// session. The newest mount owns both: it fills an empty ref with the
// container it lives in, and an older mount that goes away later hands the
// ref and the router back to the newest mount.

export type NavigationRefLike<T> = { current: T | null };

export type NavigationGlobals = {
  ref: NavigationRefLike<unknown>;
  /** expo-router's exported router, which it rebinds in place. */
  router: object;
};

export type NavigationMount = {
  /** The navigation container this mount lives in. */
  container?: unknown;
  /** The router bound to this mount's routing queue (`useRouter()`). */
  router?: object;
};

export type NavigationOwnership = {
  /** Records this mount as the owner and fills an empty ref; returns its id. */
  claim: (globals: NavigationGlobals, mount: NavigationMount) => number;
  isOwner: (id: number) => boolean;
  /** Called when a mount goes away; hands the globals back to a newer owner. */
  release: (id: number, globals: NavigationGlobals) => void;
};

export function createNavigationOwnership(): NavigationOwnership {
  let latestId = 0;
  let latest: NavigationMount = {};

  return {
    claim: (globals, mount) => {
      latestId += 1;
      latest = { container: mount.container ?? globals.ref.current, router: mount.router };
      if (globals.ref.current == null && latest.container != null) {
        globals.ref.current = latest.container;
      }
      return latestId;
    },
    isOwner: (id) => id === latestId,
    release: (id, globals) => {
      if (id === latestId) return;
      if (globals.ref.current == null && latest.container != null) {
        globals.ref.current = latest.container;
      }
      if (latest.router) Object.assign(globals.router, latest.router);
    },
  };
}

export const navigationOwnership = createNavigationOwnership();
