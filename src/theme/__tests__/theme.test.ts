import { colors, interaction, radii, spacing } from "@/src/theme";

type Rgb = readonly [number, number, number];

function parseColor(value: string): { alpha: number; rgb: Rgb } {
  const hexMatch = value.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    return {
      alpha: 1,
      rgb: [
        Number.parseInt(hexMatch[1].slice(0, 2), 16),
        Number.parseInt(hexMatch[1].slice(2, 4), 16),
        Number.parseInt(hexMatch[1].slice(4, 6), 16),
      ],
    };
  }

  const rgbaMatch = value.match(
    /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/i,
  );
  if (rgbaMatch) {
    return {
      alpha: Number(rgbaMatch[4]),
      rgb: [
        Number(rgbaMatch[1]),
        Number(rgbaMatch[2]),
        Number(rgbaMatch[3]),
      ],
    };
  }

  throw new Error(`Unsupported color token: ${value}`);
}

function alphaComposite(
  foreground: Rgb,
  background: Rgb,
  alpha: number,
): Rgb {
  const blend = (index: 0 | 1 | 2) =>
    foreground[index] * alpha + background[index] * (1 - alpha);
  return [blend(0), blend(1), blend(2)];
}

function relativeLuminance(rgb: Rgb) {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  const [red, green, blue] = rgb.map(linearize);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: Rgb, background: Rgb) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function pressedContrastRatio({
  background,
  parentSurface,
  ripple,
  text,
}: {
  background: string;
  parentSurface: string;
  ripple?: string;
  text: string;
}) {
  const parent = parseColor(parentSurface).rgb;
  const backgroundToken = parseColor(background).rgb;
  const rippledBackground = ripple
    ? (() => {
        const rippleToken = parseColor(ripple);
        return alphaComposite(
          rippleToken.rgb,
          backgroundToken,
          rippleToken.alpha,
        );
      })()
    : backgroundToken;

  return contrastRatio(
    alphaComposite(parseColor(text).rgb, parent, interaction.pressedOpacity),
    alphaComposite(rippledBackground, parent, interaction.pressedOpacity),
  );
}

describe("theme tokens", () => {
  it("matches the V1 premium true-dark palette", () => {
    expect(colors.background).toBe("#000000");
    expect(colors.surface.card).toBe("#1C1C1E");
    expect(colors.surface.elevated).toBe("#2C2C2E");
    expect(colors.primary).toBe("#34C759");
    expect(colors.deepGreen).toBe("#248A3D");
    expect(colors.profit).toBe("#34C759");
    expect(colors.text.primary).toBe("#FFFFFF");
    expect(colors.text.secondary).toBe("#98989D");
    expect(colors.text.inverse).toBe("#000000");
    expect(colors.border.subtle).toBe("rgba(255,255,255,0.10)");
  });

  it("captures Android interaction rules", () => {
    expect(interaction.minimumTouchTarget).toBe(48);
    expect(interaction.rippleColor).toBe("rgba(0,0,0,0.18)");
    expect(interaction.primaryRippleColor).toBe("rgba(0,0,0,0.06)");
    expect(interaction.pressedOpacity).toBe(0.98);
    expect(interaction.stateLayerOpacity).toBe(0.12);
  });

  it.each([
    {
      background: colors.primary,
      label: "primary green with inverse black",
      ripple: interaction.primaryRippleColor,
      text: colors.text.inverse,
    },
    {
      background: colors.primary,
      label: "primary green with inverse black and generic ripple",
      ripple: interaction.rippleColor,
      text: colors.text.inverse,
    },
    {
      background: colors.loss,
      label: "destructive red with inverse black",
      ripple: interaction.primaryRippleColor,
      text: colors.text.inverse,
    },
  ])(
    "keeps $label at normal-text contrast on root, card, and elevated surfaces",
    ({ background, ripple, text }) => {
      const parentSurfaces = [
        colors.background,
        colors.surface.card,
        colors.surface.elevated,
      ];

      expect(
        contrastRatio(parseColor(text).rgb, parseColor(background).rgb),
      ).toBeGreaterThanOrEqual(4.5);

      parentSurfaces.forEach((parentSurface) => {
        [undefined, ripple].forEach((pressedRipple) => {
          expect(
            pressedContrastRatio({
              background,
              parentSurface,
              ripple: pressedRipple,
              text,
            }),
          ).toBeGreaterThanOrEqual(4.5);
        });
      });
    },
  );

  it("keeps secondary gray at normal-text contrast on all token surfaces", () => {
    const surfaces = [
      colors.background,
      colors.surface.card,
      colors.surface.elevated,
    ];

    surfaces.forEach((surface) => {
      expect(
        contrastRatio(parseColor(colors.text.secondary).rgb, parseColor(surface).rgb),
      ).toBeGreaterThanOrEqual(4.5);

      surfaces.forEach((parentSurface) => {
        [undefined, interaction.rippleColor].forEach((pressedRipple) => {
          expect(
            pressedContrastRatio({
              background: surface,
              parentSurface,
              ripple: pressedRipple,
              text: colors.text.secondary,
            }),
          ).toBeGreaterThanOrEqual(4.5);
        });
      });
    });
  });

  it("captures the V1 spacing and radius rules", () => {
    expect(spacing.screenHorizontal).toBe(16);
    expect(spacing.cardGap).toBe(12);
    expect(spacing.cardInner).toBe(14);
    expect(radii.card).toBe(18);
    expect(radii.button).toBe(14);
  });
});
