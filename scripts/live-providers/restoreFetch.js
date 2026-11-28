// Runs after jest-expo's setup: restore Node's fetch for the live check (#825).
Object.assign(globalThis, globalThis.__liveNodeFetch);
