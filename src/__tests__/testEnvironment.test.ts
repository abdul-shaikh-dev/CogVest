declare const process: { env: Record<string, string | undefined> };

// Jest pins the time zone in jest.global-setup.js (#673): India Standard Time
// by default, with one CI job overriding it to UTC.
describe("test environment", () => {
  it("runs in the pinned time zone", () => {
    const zone = process.env.TZ;

    expect(["Asia/Kolkata", "UTC"]).toContain(zone);
    // ICU may report IST under its older alias, Asia/Calcutta.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toEqual(zone === "UTC" ? "UTC" : expect.stringMatching(/^Asia\/(Kolkata|Calcutta)$/u));
    expect(new Date("2026-11-15T00:00:00.000Z").getTimezoneOffset()).toBe(zone === "UTC" ? 0 : -330);
  });
});
