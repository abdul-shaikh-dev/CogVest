import { createSessionMemory } from "../sessionMemory";

describe("session memory (#529)", () => {
  it("returns a taken value once and keeps read values", () => {
    const memory = createSessionMemory();
    memory.write("navigation", { index: 2 });
    memory.write("cashEntryDraft", { amount: "5" });

    expect(memory.read("cashEntryDraft")).toEqual({ amount: "5" });
    expect(memory.read("cashEntryDraft")).toEqual({ amount: "5" });
    expect(memory.take("navigation")).toEqual({ index: 2 });
    expect(memory.take("navigation")).toBeUndefined();
  });

  it("clears a value written as undefined and forgets everything at once", () => {
    const memory = createSessionMemory();
    memory.write("cashEntryDraft", { amount: "5" });
    memory.write("cashEntryDraft", undefined);
    expect(memory.read("cashEntryDraft")).toBeUndefined();

    memory.write("navigation", { index: 2 });
    memory.write("cashEntryDraft", { amount: "5" });
    memory.forgetAll();
    expect(memory.read("navigation")).toBeUndefined();
    expect(memory.read("cashEntryDraft")).toBeUndefined();
  });

  it("keeps separate instances apart", () => {
    const first = createSessionMemory();
    const second = createSessionMemory();
    first.write("navigation", { index: 1 });
    expect(second.read("navigation")).toBeUndefined();
  });
});
