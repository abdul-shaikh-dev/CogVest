import { groupByAsset } from "@/src/domain/groupByAsset";

describe("groupByAsset (#720)", () => {
  it("groups in one pass and keeps each asset's original order", () => {
    const items = [
      { assetId: "b", id: 1 }, { assetId: "a", id: 2 }, { assetId: "b", id: 3 }, { assetId: "a", id: 4 },
    ];

    const groups = groupByAsset(items);

    expect([...groups.keys()]).toEqual(["b", "a"]);
    expect(groups.get("a")?.map((item) => item.id)).toEqual([2, 4]);
    expect(groups.get("b")?.map((item) => item.id)).toEqual([1, 3]);
    expect(groups.get("missing")).toBeUndefined();
  });
});
