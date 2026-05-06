import { colors, radii, spacing } from "@/src/theme";

describe("theme tokens", () => {
  it("matches the V1 premium true-dark palette", () => {
    expect(colors.background).toBe("#000000");
    expect(colors.surface.card).toBe("#1C1C1E");
    expect(colors.surface.elevated).toBe("#2C2C2E");
    expect(colors.primary).toBe("#2E7D52");
    expect(colors.profit).toBe("#34C759");
    expect(colors.text.primary).toBe("#FFFFFF");
    expect(colors.text.secondary).toBe("#8E8E93");
    expect(colors.border.subtle).toBe("rgba(255,255,255,0.10)");
  });

  it("captures the V1 spacing and radius rules", () => {
    expect(spacing.screenHorizontal).toBe(16);
    expect(spacing.cardGap).toBe(14);
    expect(spacing.cardInner).toBe(16);
    expect(radii.card).toBe(20);
    expect(radii.button).toBe(16);
  });
});
