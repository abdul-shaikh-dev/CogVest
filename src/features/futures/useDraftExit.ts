import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Keyboard } from "react-native";
import { useFocusEffect, usePreventRemove } from "expo-router/react-navigation";

export function useDraftExit(dirty: boolean, onBack: () => void) {
  const [prompt, setPrompt] = useState(false);
  const [exitAllowed, setExitAllowed] = useState(false);
  const pending = useRef<{ run: () => void; leave: boolean } | undefined>(undefined);
  const request = useCallback((run: () => void, leave = false, changed = dirty) => {
    Keyboard.dismiss();
    if (changed) {
      pending.current = { run, leave };
      setPrompt(true);
    } else if (leave) {
      pending.current = { run, leave };
      setExitAllowed(true);
    } else run();
  }, [dirty]);
  const back = useCallback(() => request(onBack, true), [onBack, request]);
  // repeat() runs the blocked action once exitAllowed has turned prevention off.
  usePreventRemove(dirty && !exitAllowed, ({ repeat }) => request(repeat, true));
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => listener.remove();
  }, [back]));
  useEffect(() => {
    if (exitAllowed) {
      const action = pending.current;
      pending.current = undefined;
      action?.run();
    }
  }, [exitAllowed]);
  return {
    prompt, request, back,
    keepEditing: () => { pending.current = undefined; setPrompt(false); },
    discard: () => {
      const action = pending.current;
      setPrompt(false);
      if (action?.leave) setExitAllowed(true);
      else { pending.current = undefined; action?.run(); }
    },
  };
}
