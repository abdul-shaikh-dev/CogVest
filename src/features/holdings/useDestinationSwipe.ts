import { useRef } from "react";
import { PanResponder } from "react-native";

import { destinationAfterSwipe, isHorizontalIntent, type HoldingsDestination } from "./destinationSwipe";

/**
 * A horizontal swipe moves between the Market, PPF and EPF destinations.
 * Vertical scrolls, multi-touch and open sheets or details never switch.
 */
export function useDestinationSwipe({
  active,
  blocked,
  destinations,
  onSelect,
}: {
  active: HoldingsDestination;
  blocked: boolean;
  destinations: readonly HoldingsDestination[];
  onSelect: (destination: HoldingsDestination) => void;
}) {
  const verticalGesture = useRef(false);

  // PanResponder.create only stores these handlers; they read the ref on touch, never during render.
  // eslint-disable-next-line react-hooks/refs
  return PanResponder.create({
    onStartShouldSetPanResponderCapture: (_, gesture) => {
      verticalGesture.current = gesture.numberActiveTouches !== 1;
      return false;
    },
    onMoveShouldSetPanResponderCapture: (_, gesture) => {
      if (gesture.numberActiveTouches > 1 ||
          (Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) >= Math.abs(gesture.dx))) {
        verticalGesture.current = true;
      }
      return destinations.length > 1 && !blocked &&
        !verticalGesture.current && gesture.numberActiveTouches === 1 &&
        isHorizontalIntent(gesture.dx, gesture.dy);
    },
    onPanResponderMove: (_, gesture) => {
      if (gesture.numberActiveTouches > 1 ||
          Math.abs(gesture.dy) >= Math.abs(gesture.dx)) {
        verticalGesture.current = true;
      }
    },
    onPanResponderTerminate: () => { verticalGesture.current = true; },
    onPanResponderRelease: (_, gesture) => {
      const destination = destinationAfterSwipe(gesture.dx, gesture.dy, destinations, active);
      if (destination && !verticalGesture.current && destinations.length > 1 &&
          !blocked) onSelect(destination);
    },
    onPanResponderTerminationRequest: () => true,
  });
}
