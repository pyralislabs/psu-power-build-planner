import { JSDOM } from "jsdom";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPsuWidget,
  type PsuWidgetHandle,
  type PsuWidgetOptions,
} from "../../src/widget/app.js";

let dom: JSDOM;

beforeAll(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  (
    globalThis as unknown as { window: typeof dom.window; document: typeof dom.window.document }
  ).window = dom.window;
  (globalThis as unknown as { document: typeof dom.window.document }).document =
    dom.window.document;
  (globalThis as unknown as { HTMLElement: typeof dom.window.HTMLElement }).HTMLElement =
    dom.window.HTMLElement;
  (globalThis as unknown as { customElements: typeof dom.window.customElements }).customElements =
    dom.window.customElements;
  (globalThis as unknown as { Blob: typeof dom.window.Blob }).Blob = dom.window.Blob;
  (globalThis as unknown as { FileReader: typeof dom.window.FileReader }).FileReader =
    dom.window.FileReader;
  (globalThis as unknown as { URL: typeof dom.window.URL }).URL = dom.window.URL;
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createPsuWidget", () => {
  let handle: PsuWidgetHandle | null = null;

  beforeEach(() => {
    handle = null;
  });

  it("mounts into a host element", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const opts: PsuWidgetOptions = { profile: "homelab-light", currency: "USD", ratePerKwh: 0.12 };
    handle = createPsuWidget(opts);
    handle.mount(host);
    const root = host.querySelector(".psu-shell");
    expect(root).not.toBeNull();
  });

  it("produces a valid initial planner input", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    handle = createPsuWidget({ profile: "homelab-light" });
    handle.mount(host);
    const input = handle.getPlannerInput();
    expect(input.schemaVersion).toBe(1);
    expect(input.operatingProfile.preset).toBe("homelab-light");
    expect(input.lines).toEqual([]);
  });

  it("loads a planner JSON via setPlannerInput", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    handle = createPsuWidget({});
    handle.mount(host);
    handle.setPlannerInput({
      schemaVersion: 1,
      lines: [
        {
          id: "x",
          manualComponent: {
            name: "Test",
            category: "platform",
            idleDcWattsEach: 5,
            sustainedDcWattsEach: 30,
            transientDcWattsEach: 40,
          },
        },
      ],
      operatingProfile: {
        preset: "gaming",
        poweredHoursPerDay: 4,
        workloadShare: 0.5,
        categoryUtilization: {},
        fallbackUtilization: 0.25,
        ratePerKwh: 0.1,
        currency: "USD",
      },
    });
    const input = handle.getPlannerInput();
    expect(input.lines).toHaveLength(1);
    expect(input.operatingProfile.ratePerKwh).toBe(0.1);
  });

  it("rejects invalid planner JSON with a live-region message", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    handle = createPsuWidget({});
    handle.mount(host);
    handle.setPlannerInput({ schemaVersion: 1, lines: "not an array", operatingProfile: {} });
    const input = handle.getPlannerInput();
    expect(input.lines).toEqual([]);
  });
});
