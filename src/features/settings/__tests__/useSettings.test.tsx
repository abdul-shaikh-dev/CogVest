import { act, renderHook } from "@testing-library/react-native";

import { useSettings } from "@/src/features/settings/useSettings";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

describe("useSettings", () => {
  it("toggles and persists the global value masking preference", () => {
    const storage = createMemoryJsonStorage();
    const firstStore = createPortfolioStore({ storage });
    const { result } = renderHook(() => useSettings({ store: firstStore }));

    expect(result.current.maskWealthValues).toBe(false);

    act(() => {
      result.current.toggleMaskWealthValues();
    });

    expect(result.current.maskWealthValues).toBe(true);

    const secondStore = createPortfolioStore({ storage });

    expect(secondStore.getState().preferences.maskWealthValues).toBe(true);
  });
});
