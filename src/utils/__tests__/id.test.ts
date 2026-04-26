import { createId } from "@/src/utils";

describe("createId", () => {
  it("prefixes IDs with the requested entity name", () => {
    expect(createId("trade")).toMatch(/^trade_[a-z0-9]+_[a-z0-9]+$/);
  });

  it("creates different IDs across calls", () => {
    expect(createId("asset")).not.toBe(createId("asset"));
  });
});
