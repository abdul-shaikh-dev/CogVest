import { useEffect, useRef } from "react";

/**
 * Opens an import screen's file step once on arrival when "Import a file"
 * already chose the file (#771). The screen's picker returns that pending file,
 * so the review starts without a second picker.
 */
export function useAutoSelectOnce(enabled: boolean | undefined, select: () => unknown) {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    void select();
    // Once per screen, with the handler of the render that enabled it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
