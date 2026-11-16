import { useReducedMotionPreference } from "./useReducedMotionPreference";

/** A modal's fade, or none when the person has asked for reduced motion (#670). */
export function useModalAnimation(): "fade" | "none" {
  return useReducedMotionPreference() ? "none" : "fade";
}
