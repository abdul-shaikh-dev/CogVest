import { darkColors, lightColors } from "../palettes";
const { patchModalAppearance } = require("../../../plugins/withModalAppearance");

describe("Android modal appearance integration", () => {
  const source = "class MainActivity : ReactActivity() {\n}";
  it("updates existing windows on configuration change and resume without recreation", () => {
    const patched = patchModalAppearance(source);
    expect(patched).toContain("super.onConfigurationChanged(newConfig)");
    expect(patched).toContain("super.onResume()");
    expect(patched).toContain("isAppearanceLightStatusBars = light");
    expect(patched).toContain("isAppearanceLightNavigationBars = light");
    expect(patched).toContain("if (!view.transparent)");
    expect(patched).toContain(darkColors.background);
    expect(patched).toContain(lightColors.background);
    expect(patched).not.toMatch(/recreate\(|dismiss\(/);
    expect(patchModalAppearance(patched)).toBe(patched);
  });
  it("fails closed when the native integration point changes", () => {
    expect(() => patchModalAppearance("class OtherActivity {}" )).toThrow();
    expect(() => patchModalAppearance(source.replace("\n}", "override fun onResume() {}\n}"))).toThrow();
  });
});
