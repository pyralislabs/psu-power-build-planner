import { createPsuWidget, type PsuWidgetOptions } from "./app.js";
import cssText from "./styles.css?inline";
import type { WorkloadPreset } from "../core/types.js";

class PsuPlannerElement extends HTMLElement {
  private widget: ReturnType<typeof createPsuWidget> | null = null;

  static get observedAttributes(): ReadonlyArray<string> {
    return ["data-profile", "data-currency", "data-rate-per-kwh"];
  }

  private getOptionsFromAttributes(): PsuWidgetOptions {
    const opts: PsuWidgetOptions = {};
    const profile = this.getAttribute("data-profile");
    if (profile) opts.profile = profile as WorkloadPreset;
    const currency = this.getAttribute("data-currency");
    if (currency) opts.currency = currency;
    const rate = this.getAttribute("data-rate-per-kwh");
    if (rate) {
      const n = Number(rate);
      if (Number.isFinite(n) && n >= 0) {
        opts.ratePerKwh = n;
      }
    }
    return opts;
  }

  private attach(): void {
    if (this.widget) {
      return;
    }
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = cssText;
    shadow.appendChild(style);
    const host = document.createElement("div");
    shadow.appendChild(host);
    this.widget = createPsuWidget(this.getOptionsFromAttributes());
    this.widget.mount(host);
  }

  connectedCallback(): void {
    this.attach();
  }

  disconnectedCallback(): void {
    if (this.widget) {
      this.widget.unmount();
      this.widget = null;
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (!this.widget) return;
    if (name === "data-profile" && typeof newValue === "string") {
      this.widget.setPlannerInput({
        schemaVersion: 1,
        lines: [],
        operatingProfile: {
          preset: newValue,
          poweredHoursPerDay: 8,
          workloadShare: 0.5,
          categoryUtilization: {},
          fallbackUtilization: 0.25,
          ratePerKwh: 0.16,
          currency: "USD",
        },
      });
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("psu-power-build-planner")) {
  customElements.define("psu-power-build-planner", PsuPlannerElement);
}

export { PsuPlannerElement };
