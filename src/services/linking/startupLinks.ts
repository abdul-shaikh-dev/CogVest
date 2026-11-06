import { Linking } from "react-native";

// Android hands a link to a running app as a one-off `url` event. During
// startup nothing is listening yet: expo-router subscribes when its container
// mounts, and the root layout keeps the navigator unmounted until required
// assets load. A link that arrives in that window is otherwise lost, and the
// app stays on its launch route. Links that start the app are not affected:
// they arrive as the initial URL.

type UrlEvent = { url: string };
type LinkingLike = {
  addEventListener: (
    type: "url",
    handler: (event: UrlEvent) => void,
  ) => { remove: () => void };
};

export type StartupLinkCapture = {
  /** Stops capturing and returns the most recent captured link, if any. */
  finish: () => string | undefined;
};

export function createStartupLinkCapture(
  linking: LinkingLike = Linking,
): StartupLinkCapture {
  let latest: string | undefined;
  let subscription: { remove: () => void } | undefined =
    linking.addEventListener("url", ({ url }) => {
      latest = url;
    });

  return {
    finish: () => {
      subscription?.remove();
      subscription = undefined;
      const url = latest;
      latest = undefined;
      return url;
    },
  };
}

/**
 * Turns an app link such as `cogvest:///settings?x=1` or `cogvest://settings`
 * into a router path. Returns undefined for anything that is not a
 * scheme-qualified link.
 */
export function startupLinkToPath(url: string): string | undefined {
  const match = /^[a-z][a-z0-9+.-]*:\/\/(.*)$/i.exec(url.trim());
  if (!match) return undefined;
  const rest = match[1];
  return rest.startsWith("/") ? rest : `/${rest}`;
}

let appCapture: StartupLinkCapture | undefined;

/** Called once from the app entry, before the router loads. */
export function startStartupLinkCapture() {
  appCapture ??= createStartupLinkCapture();
}

/**
 * Called once the navigator is mounted. Returns the router path of a link
 * that arrived while nothing could handle it, and stops capturing so later
 * links are left to expo-router alone.
 */
export function takeStartupLinkPath(): string | undefined {
  const url = appCapture?.finish();
  appCapture = undefined;
  return url === undefined ? undefined : startupLinkToPath(url);
}
