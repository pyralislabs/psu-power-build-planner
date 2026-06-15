import { describe, expect, it } from "vitest";
import {
  getComponent,
  getEfficiencyProfile,
  getSource,
  listComponents,
  listEfficiencyProfiles,
  listSources,
  datasetMeta,
} from "../../src/data/index.js";

describe("dataset accessors", () => {
  it("listComponents returns a sorted, defensive copy", () => {
    const first = listComponents();
    expect(first.length).toBeGreaterThan(0);
    const ids = first.map((c) => c.id);
    const sorted = ids.slice().sort();
    expect(ids).toEqual(sorted);
    const firstCopy = first[0]!;
    const handleCopy = listComponents()[0]!;
    expect(handleCopy).not.toBe(firstCopy);
    handleCopy.manufacturer = "MUTATED";
    expect(first[0]!.manufacturer).not.toBe("MUTATED");
  });

  it("listComponents filters by category", () => {
    const cpus = listComponents({ category: "cpu" });
    expect(cpus.every((c) => c.category === "cpu")).toBe(true);
    expect(cpus.length).toBeGreaterThan(0);
  });

  it("listComponents filters by query", () => {
    const r = listComponents({ query: "4090" });
    expect(r.length).toBeGreaterThan(0);
    expect(
      r.every((c) => /4090/i.test(`${c.manufacturer} ${c.model} ${(c.aliases ?? []).join(" ")}`)),
    ).toBe(true);
  });

  it("getComponent returns defensive copy or undefined", () => {
    const c = getComponent("intel-core-i9-14900k");
    expect(c).toBeDefined();
    const c2 = getComponent("intel-core-i9-14900k");
    expect(c2).not.toBe(c);
    expect(getComponent("definitely-not-a-real-id")).toBeUndefined();
  });

  it("listSources returns sorted, defensive copies", () => {
    const s = listSources();
    expect(s.length).toBeGreaterThan(0);
    const ids = s.map((x) => x.id);
    expect(ids).toEqual(ids.slice().sort());
    const s2 = listSources();
    expect(s[0]).not.toBe(s2[0]);
  });

  it("getSource returns defensive copy or undefined", () => {
    const s = getSource("intel-ark-i9-14900k");
    expect(s).toBeDefined();
    expect(getSource("not-a-real-source")).toBeUndefined();
  });

  it("listEfficiencyProfiles returns sorted, defensive copies", () => {
    const e = listEfficiencyProfiles();
    expect(e.length).toBeGreaterThanOrEqual(4);
    const ids = e.map((x) => x.id);
    expect(ids).toEqual(ids.slice().sort());
  });

  it("getEfficiencyProfile returns defensive copy or undefined", () => {
    const e = getEfficiencyProfile("generic-80-plus-gold-115v-conservative");
    expect(e).toBeDefined();
    expect(e!.points.length).toBeGreaterThanOrEqual(2);
    expect(getEfficiencyProfile("not-a-real-profile")).toBeUndefined();
  });

  it("datasetMeta exposes counts", () => {
    expect(datasetMeta.components.count).toBeGreaterThanOrEqual(100);
    expect(datasetMeta.sources.count).toBeGreaterThanOrEqual(30);
    expect(datasetMeta.efficiencyProfiles.count).toBeGreaterThanOrEqual(4);
    expect(datasetMeta.categories.length).toBe(8);
  });
});
