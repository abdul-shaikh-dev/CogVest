import { colors, radii, spacing } from "@/src/theme";

describe("theme tokens", () => {
  it("matches the V1 CogVest dark palette", () => {
    expect(colors.background).toBe("#1C1B1F");
    expect(colors.surface.card).toBe("#2A2930");
    expect(colors.surface.elevated).toBe("#312F36");
    expect(colors.primary).toBe("#2E7D52");
    expect(colors.text.primary).toBe("#E6E1E5");
    expect(colors.text.secondary).toBe("#CAC4D0");
    expect(colors.border.subtle).toBe("rgba(255,255,255,0.08)");
  });

  it("captures the V1 spacing and radius rules", () => {
    expect(spacing.screenHorizontal).toBe(16);
    expect(spacing.cardGap).toBe(10);
    expect(spacing.cardInner).toBe(12);
    expect(radii.card).toBe(12);
    expect(radii.button).toBe(16);
  });
});
