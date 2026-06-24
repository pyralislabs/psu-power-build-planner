import {
  listComponents,
  getComponent,
  listEfficiencyProfiles,
  planBuild,
  validatePlannerInput,
  PlannerValidationError,
} from "../index.js";
import type {
  BuildLineInput,
  ComponentCategory,
  PlannerInput,
  PlannerResult,
  WorkloadPreset,
} from "../core/types.js";
import type { ComponentRecord } from "../data/types.js";
import { PlannerUnsupportedError } from "../core/errors.js";

const KNOWN_CATEGORIES: ReadonlyArray<ComponentCategory> = [
  "platform",
  "cpu",
  "gpu",
  "memory",
  "storage",
  "cooling",
  "network",
  "accessory",
];

const PRESETS: ReadonlyArray<WorkloadPreset> = [
  "local-ai-inference",
  "local-ai-always-on",
  "gaming",
  "homelab-light",
  "workstation",
  "custom",
];

const PROFILE_DEFAULTS: Readonly<
  Record<
    WorkloadPreset,
    { poweredHoursPerDay: number; workloadShare: number; fallbackUtilization: number }
  >
> = {
  "local-ai-inference": { poweredHoursPerDay: 8, workloadShare: 0.5, fallbackUtilization: 0.25 },
  "local-ai-always-on": { poweredHoursPerDay: 24, workloadShare: 0.35, fallbackUtilization: 0.2 },
  gaming: { poweredHoursPerDay: 4, workloadShare: 0.75, fallbackUtilization: 0.2 },
  "homelab-light": { poweredHoursPerDay: 24, workloadShare: 0.15, fallbackUtilization: 0.2 },
  workstation: { poweredHoursPerDay: 8, workloadShare: 0.7, fallbackUtilization: 0.3 },
  custom: { poweredHoursPerDay: 8, workloadShare: 0.5, fallbackUtilization: 0.25 },
};

export interface PsuWidgetOptions {
  profile?: WorkloadPreset;
  currency?: string;
  ratePerKwh?: number;
}

export interface PsuWidgetHandle {
  readonly root: HTMLElement;
  readonly mount: (container: HTMLElement) => void;
  readonly unmount: () => void;
  readonly getPlannerInput: () => PlannerInput;
  readonly setPlannerInput: (input: unknown) => void;
}

interface WidgetState {
  profile: WorkloadPreset;
  poweredHoursPerDay: number;
  daysPerYear: number;
  workloadShare: number;
  fallbackUtilization: number;
  ratePerKwh: number;
  currency: string;
  efficiencyProfileId: string;
  efficiencyOverrideFraction: number | null;
  evaluatedPsuCapacityWatts: number | null;
  lines: BuildLineInput[];
  result: PlannerResult | null;
  errors: string[];
  searchQuery: string;
  searchCategory: ComponentCategory | "";
  searchResults: ComponentRecord[];
  liveMessage: string;
}

function initialState(opts: PsuWidgetOptions): WidgetState {
  const profile = opts.profile ?? "local-ai-inference";
  const preset = PROFILE_DEFAULTS[profile] ?? PROFILE_DEFAULTS["local-ai-inference"];
  return {
    profile,
    poweredHoursPerDay: preset.poweredHoursPerDay,
    daysPerYear: 365,
    workloadShare: preset.workloadShare,
    fallbackUtilization: preset.fallbackUtilization,
    ratePerKwh: opts.ratePerKwh ?? 0.16,
    currency: opts.currency ?? "USD",
    efficiencyProfileId: "generic-80-plus-gold-115v-conservative",
    efficiencyOverrideFraction: null,
    evaluatedPsuCapacityWatts: null,
    lines: [],
    result: null,
    errors: [],
    searchQuery: "",
    searchCategory: "",
    searchResults: [],
    liveMessage: "",
  };
}

function newId(): string {
  return `line-${crypto.randomUUID()}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === "" || v === null || v === undefined) continue;
    if (k === "class") node.className = String(v);
    else if (k === "htmlFor") (node as HTMLLabelElement).htmlFor = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const child of children) {
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function setText(target: HTMLElement, value: string): void {
  if (target.textContent !== value) {
    target.textContent = value;
  }
}

function formatNumber(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount === null || !Number.isFinite(amount)) return "n/a";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function buildPlannerInput(state: WidgetState): PlannerInput {
  return {
    schemaVersion: 1,
    lines: state.lines,
    operatingProfile: {
      preset: state.profile,
      poweredHoursPerDay: state.poweredHoursPerDay,
      daysPerYear: state.daysPerYear,
      workloadShare: state.workloadShare,
      categoryUtilization: {},
      fallbackUtilization: state.fallbackUtilization,
      ratePerKwh: state.ratePerKwh,
      currency: state.currency,
    },
    ...(state.evaluatedPsuCapacityWatts !== null
      ? { evaluatedPsuCapacityWatts: state.evaluatedPsuCapacityWatts }
      : {}),
    ...(state.efficiencyProfileId ? { efficiencyProfileId: state.efficiencyProfileId } : {}),
    ...(state.efficiencyOverrideFraction !== null
      ? { efficiencyOverrideFraction: state.efficiencyOverrideFraction }
      : {}),
  };
}

function recompute(state: WidgetState): void {
  state.errors = [];
  state.result = null;
  if (state.lines.length === 0) {
    return;
  }
  try {
    state.result = planBuild(buildPlannerInput(state));
  } catch (err) {
    if (err instanceof PlannerValidationError) {
      state.errors = err.issues.map((i) => `${i.path}: ${i.message}`);
    } else if (err instanceof PlannerUnsupportedError) {
      state.errors = [`${err.code}: ${err.message}`];
    } else {
      state.errors = [err instanceof Error ? err.message : String(err)];
    }
  }
}

function downloadJson(filename: string, data: unknown): void {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function createLiveRegion(): HTMLElement {
  const live = el("div", {
    class: "psu-sr-only",
    "aria-live": "polite",
    "aria-atomic": "true",
  });
  return live;
}

function renderLinesSection(state: WidgetState, root: HTMLElement, handle: PsuWidgetHandle): void {
  clear(root);
  const section = el("section", { class: "psu-section", "aria-labelledby": "psu-lines-heading" });
  const heading = el("h2", { id: "psu-lines-heading" }, "Build lines");
  section.appendChild(heading);

  const list = el("ul", { class: "psu-list", "aria-label": "Selected build lines" });
  if (state.lines.length === 0) {
    list.appendChild(el("li", {}, "No components yet. Use the search below to add lines."));
  } else {
    for (const line of state.lines) {
      const li = el("li", {});
      const name = el("span", { class: "psu-line-name" }, line.id);
      const meta = el("span", { class: "psu-line-meta" });
      if (line.manualComponent) {
        setText(
          meta,
          `manual: ${line.manualComponent.name} (${line.manualComponent.category}, ${formatNumber(line.manualComponent.sustainedDcWattsEach)} W sustained)${line.quantity && line.quantity > 1 ? ` x ${line.quantity}` : ""}`,
        );
      } else if (line.componentId) {
        const c = getComponent(line.componentId);
        const desc = c ? `${c.manufacturer} ${c.model} (${c.category})` : line.componentId;
        setText(meta, `${desc}${line.quantity && line.quantity > 1 ? ` x ${line.quantity}` : ""}`);
      }
      const qty = el("input", {
        type: "number",
        min: "1",
        max: "32",
        step: "1",
        class: "psu-input",
        "aria-label": `Quantity for ${line.id}`,
        value: String(line.quantity ?? 1),
        style: "max-width: 4rem; flex: 0 0 4rem;",
      });
      qty.addEventListener("change", () => {
        const v = Number(qty.value);
        if (Number.isInteger(v) && v >= 1 && v <= 32) {
          line.quantity = v;
          recompute(state);
          handle.getPlannerInput();
          rerender(handle);
          announce(state, `Updated quantity for ${line.id} to ${v}.`);
        } else {
          qty.value = String(line.quantity ?? 1);
        }
      });
      const remove = el(
        "button",
        { type: "button", class: "psu-button psu-button-ghost" },
        "Remove",
      );
      remove.addEventListener("click", () => {
        state.lines = state.lines.filter((l) => l.id !== line.id);
        recompute(state);
        rerender(handle);
        announce(state, `Removed line ${line.id}.`);
      });
      li.appendChild(name);
      li.appendChild(meta);
      li.appendChild(qty);
      li.appendChild(remove);
      list.appendChild(li);
    }
  }
  section.appendChild(list);

  const details = el("details");
  const summary = el("summary", {}, "Add a manual component");
  details.appendChild(summary);
  const manualForm = el("div", { class: "psu-row" });
  const mName = el("input", {
    class: "psu-input",
    "aria-label": "Manual component name",
    placeholder: "Name",
  });
  const mCategory = el("select", {
    class: "psu-select",
    "aria-label": "Manual component category",
  });
  for (const c of KNOWN_CATEGORIES) {
    const opt = el("option", { value: c }, c);
    mCategory.appendChild(opt);
  }
  const mIdle = el("input", {
    class: "psu-input",
    type: "number",
    min: "0",
    step: "0.1",
    "aria-label": "Idle watts each",
    placeholder: "Idle W",
  });
  const mSustained = el("input", {
    class: "psu-input",
    type: "number",
    min: "0",
    step: "0.1",
    "aria-label": "Sustained watts each",
    placeholder: "Sustained W",
  });
  const mTransient = el("input", {
    class: "psu-input",
    type: "number",
    min: "0",
    step: "0.1",
    "aria-label": "Transient watts each",
    placeholder: "Transient W",
  });
  const addBtn = el("button", { type: "button", class: "psu-button" }, "Add manual");
  addBtn.addEventListener("click", () => {
    const name = mName.value.trim();
    const idle = Number(mIdle.value);
    const sustained = Number(mSustained.value);
    const transientRaw = mTransient.value.trim();
    const transient = transientRaw === "" ? sustained : Number(transientRaw);
    if (!name) {
      announce(state, "Manual component requires a name.");
      return;
    }
    if (
      !Number.isFinite(idle) ||
      idle < 0 ||
      !Number.isFinite(sustained) ||
      sustained < 0 ||
      !Number.isFinite(transient) ||
      transient < 0
    ) {
      announce(state, "Manual power values must be non-negative numbers.");
      return;
    }
    if (idle > sustained || sustained > transient) {
      announce(state, "Manual power values must satisfy idle <= sustained <= transient.");
      return;
    }
    const id = newId();
    state.lines.push({
      id,
      manualComponent: {
        name,
        category: mCategory.value as ComponentCategory,
        idleDcWattsEach: idle,
        sustainedDcWattsEach: sustained,
        transientDcWattsEach: transient,
      },
      quantity: 1,
    });
    mName.value = "";
    mIdle.value = "";
    mSustained.value = "";
    mTransient.value = "";
    recompute(state);
    rerender(handle);
    announce(state, `Added manual component ${name}.`);
  });
  manualForm.appendChild(
    el("div", {}, el("label", { class: "psu-label", htmlFor: "psu-m-name" }, "Name"), mName),
  );
  manualForm.appendChild(
    el("div", {}, el("label", { class: "psu-label", htmlFor: "psu-m-cat" }, "Category"), mCategory),
  );
  manualForm.appendChild(
    el("div", {}, el("label", { class: "psu-label", htmlFor: "psu-m-idle" }, "Idle W"), mIdle),
  );
  manualForm.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-m-sus" }, "Sustained W"),
      mSustained,
    ),
  );
  manualForm.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-m-tr" }, "Transient W"),
      mTransient,
    ),
  );
  details.appendChild(manualForm);
  details.appendChild(addBtn);
  section.appendChild(details);

  const searchHeading = el(
    "h3",
    { style: "margin: 1rem 0 0.25rem 0; font-size: 0.95rem;" },
    "Search the dataset",
  );
  section.appendChild(searchHeading);
  const searchRow = el("div", { class: "psu-row" });
  const sCategory = el("select", { class: "psu-select", "aria-label": "Filter by category" });
  sCategory.appendChild(el("option", { value: "" }, "All categories"));
  for (const c of KNOWN_CATEGORIES) {
    sCategory.appendChild(el("option", { value: c }, c));
  }
  sCategory.value = state.searchCategory;
  sCategory.addEventListener("change", () => {
    state.searchCategory = sCategory.value as ComponentCategory | "";
    state.searchResults = listComponents({
      ...(state.searchCategory ? { category: state.searchCategory as ComponentCategory } : {}),
      ...(state.searchQuery ? { query: state.searchQuery } : {}),
    }).slice(0, 100);
    rerender(handle);
  });
  const sQuery = el("input", {
    class: "psu-input",
    "aria-label": "Search components by name",
    placeholder: "Search by manufacturer or model",
  });
  sQuery.value = state.searchQuery;
  sQuery.addEventListener("input", () => {
    state.searchQuery = sQuery.value;
    state.searchResults = listComponents({
      ...(state.searchCategory ? { category: state.searchCategory as ComponentCategory } : {}),
      ...(state.searchQuery ? { query: state.searchQuery } : {}),
    }).slice(0, 100);
    rerender(handle);
  });
  searchRow.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-search-cat" }, "Category"),
      sCategory,
    ),
  );
  searchRow.appendChild(
    el(
      "div",
      { class: "psu-grow" },
      el("label", { class: "psu-label", htmlFor: "psu-search-q" }, "Query"),
      sQuery,
    ),
  );
  section.appendChild(searchRow);

  const hasResults = state.searchResults.length > 0;
  const resultsBox = el("div", {
    class: "psu-search-list",
    role: hasResults ? "listbox" : "status",
    "aria-label": hasResults ? "Component search results" : undefined,
  });
  if (!hasResults) {
    resultsBox.appendChild(
      el(
        "div",
        { class: "psu-search-item" },
        "Type to search across the bundled component dataset.",
      ),
    );
  } else {
    for (const c of state.searchResults) {
      const item = el("div", {
        class: "psu-search-item",
        role: "option",
        "data-component-id": c.id,
      });
      item.tabIndex = 0;
      const label = el("div", {}, `${c.manufacturer} ${c.model}`);
      const meta = el(
        "div",
        { class: "psu-line-meta" },
        `${c.category} - sustained ${c.power.sustained.watts}W (${c.power.sustained.confidence})`,
      );
      item.appendChild(label);
      item.appendChild(meta);
      item.addEventListener("click", () => addComponent(state, c, handle));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          addComponent(state, c, handle);
        }
      });
      resultsBox.appendChild(item);
    }
  }
  section.appendChild(resultsBox);

  root.appendChild(section);
}

function addComponent(state: WidgetState, record: ComponentRecord, handle: PsuWidgetHandle): void {
  if (state.lines.some((l) => l.componentId === record.id)) {
    announce(state, `${record.id} is already in the build.`);
    return;
  }
  const id = newId();
  state.lines.push({ id, componentId: record.id, quantity: 1 });
  recompute(state);
  rerender(handle);
  announce(state, `Added ${record.manufacturer} ${record.model} to the build.`);
}

function renderProfileSection(
  state: WidgetState,
  root: HTMLElement,
  handle: PsuWidgetHandle,
): void {
  clear(root);
  const section = el("section", { class: "psu-section", "aria-labelledby": "psu-profile-heading" });
  section.appendChild(el("h2", { id: "psu-profile-heading" }, "Workload profile"));
  const row = el("div", { class: "psu-row" });

  const presetSel = el("select", { class: "psu-select", "aria-label": "Workload preset" });
  for (const p of PRESETS) {
    const opt = el("option", { value: p }, p);
    if (p === state.profile) opt.selected = true;
    presetSel.appendChild(opt);
  }
  presetSel.addEventListener("change", () => {
    state.profile = presetSel.value as WorkloadPreset;
    const d = PROFILE_DEFAULTS[state.profile] ?? PROFILE_DEFAULTS["local-ai-inference"];
    state.poweredHoursPerDay = d.poweredHoursPerDay;
    state.workloadShare = d.workloadShare;
    state.fallbackUtilization = d.fallbackUtilization;
    recompute(state);
    rerender(handle);
    announce(state, `Profile set to ${state.profile}.`);
  });

  const powered = el("input", {
    class: "psu-input",
    type: "number",
    min: "0",
    max: "24",
    step: "0.5",
    "aria-label": "Powered hours per day",
  });
  powered.value = String(state.poweredHoursPerDay);
  powered.addEventListener("change", () => {
    const v = Number(powered.value);
    if (Number.isFinite(v) && v > 0 && v <= 24) {
      state.poweredHoursPerDay = v;
      recompute(state);
      rerender(handle);
    } else {
      powered.value = String(state.poweredHoursPerDay);
    }
  });

  const days = el("input", {
    class: "psu-input",
    type: "number",
    min: "1",
    max: "366",
    step: "1",
    "aria-label": "Days per year",
  });
  days.value = String(state.daysPerYear);
  days.addEventListener("change", () => {
    const v = Number(days.value);
    if (Number.isInteger(v) && v >= 1 && v <= 366) {
      state.daysPerYear = v;
      recompute(state);
      rerender(handle);
    } else {
      days.value = String(state.daysPerYear);
    }
  });

  const share = el("input", {
    class: "psu-input",
    type: "number",
    min: "0",
    max: "1",
    step: "0.05",
    "aria-label": "Workload share",
  });
  share.value = String(state.workloadShare);
  share.addEventListener("change", () => {
    const v = Number(share.value);
    if (Number.isFinite(v) && v >= 0 && v <= 1) {
      state.workloadShare = v;
      recompute(state);
      rerender(handle);
    } else {
      share.value = String(state.workloadShare);
    }
  });

  const fallback = el("input", {
    class: "psu-input",
    type: "number",
    min: "0",
    max: "1",
    step: "0.05",
    "aria-label": "Fallback utilization",
  });
  fallback.value = String(state.fallbackUtilization);
  fallback.addEventListener("change", () => {
    const v = Number(fallback.value);
    if (Number.isFinite(v) && v >= 0 && v <= 1) {
      state.fallbackUtilization = v;
      recompute(state);
      rerender(handle);
    } else {
      fallback.value = String(state.fallbackUtilization);
    }
  });

  const rate = el("input", {
    class: "psu-input",
    type: "number",
    min: "0",
    step: "0.01",
    "aria-label": "Rate per kWh",
  });
  rate.value = String(state.ratePerKwh);
  rate.addEventListener("change", () => {
    const v = Number(rate.value);
    if (Number.isFinite(v) && v >= 0) {
      state.ratePerKwh = v;
      recompute(state);
      rerender(handle);
    } else {
      rate.value = String(state.ratePerKwh);
    }
  });

  const currency = el("input", {
    class: "psu-input",
    type: "text",
    maxlength: "3",
    "aria-label": "Currency (ISO 4217)",
  });
  currency.value = state.currency;
  currency.addEventListener("change", () => {
    const v = currency.value.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(v)) {
      state.currency = v;
      recompute(state);
      rerender(handle);
    } else {
      currency.value = state.currency;
    }
  });

  row.appendChild(
    el("div", {}, el("label", { class: "psu-label", htmlFor: "psu-preset" }, "Preset"), presetSel),
  );
  row.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-powered" }, "Powered h/day"),
      powered,
    ),
  );
  row.appendChild(
    el("div", {}, el("label", { class: "psu-label", htmlFor: "psu-days" }, "Days/year"), days),
  );
  row.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-share" }, "Workload share"),
      share,
    ),
  );
  row.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-fallback" }, "Fallback util"),
      fallback,
    ),
  );
  row.appendChild(
    el("div", {}, el("label", { class: "psu-label", htmlFor: "psu-rate" }, "Rate/kWh"), rate),
  );
  row.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-currency" }, "Currency"),
      currency,
    ),
  );
  section.appendChild(row);

  const effRow = el("div", { class: "psu-row" });
  const profiles = listEfficiencyProfiles();
  const effSel = el("select", { class: "psu-select", "aria-label": "Efficiency profile" });
  effSel.appendChild(el("option", { value: "" }, "(none)"));
  for (const p of profiles) {
    const opt = el("option", { value: p.id }, p.label);
    if (p.id === state.efficiencyProfileId) opt.selected = true;
    effSel.appendChild(opt);
  }
  effSel.addEventListener("change", () => {
    state.efficiencyProfileId = effSel.value;
    recompute(state);
    rerender(handle);
    announce(state, `Efficiency profile set to ${state.efficiencyProfileId || "none"}.`);
  });
  const psuEval = el("input", {
    class: "psu-input",
    type: "number",
    min: "50",
    step: "10",
    "aria-label": "Evaluated PSU watts (optional)",
  });
  psuEval.value =
    state.evaluatedPsuCapacityWatts === null ? "" : String(state.evaluatedPsuCapacityWatts);
  psuEval.addEventListener("change", () => {
    const v = psuEval.value.trim();
    if (v === "") {
      state.evaluatedPsuCapacityWatts = null;
    } else {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 50 && n <= 10000) {
        state.evaluatedPsuCapacityWatts = n;
      } else {
        psuEval.value =
          state.evaluatedPsuCapacityWatts === null ? "" : String(state.evaluatedPsuCapacityWatts);
        return;
      }
    }
    recompute(state);
    rerender(handle);
  });
  effRow.appendChild(
    el(
      "div",
      { class: "psu-grow" },
      el("label", { class: "psu-label", htmlFor: "psu-eff" }, "Efficiency profile"),
      effSel,
    ),
  );
  effRow.appendChild(
    el(
      "div",
      {},
      el("label", { class: "psu-label", htmlFor: "psu-psu" }, "Evaluated PSU (W, optional)"),
      psuEval,
    ),
  );
  section.appendChild(effRow);

  root.appendChild(section);
}

function renderResultsSection(
  state: WidgetState,
  root: HTMLElement,
  _handle: PsuWidgetHandle,
): void {
  clear(root);
  const section = el("section", {
    class: "psu-section",
    "aria-labelledby": "psu-results-heading",
    role: "region",
  });
  section.appendChild(el("h2", { id: "psu-results-heading" }, "Results"));

  if (state.errors.length > 0) {
    const errBox = el("div", { role: "alert", "aria-labelledby": "psu-err-heading" });
    errBox.appendChild(el("p", { id: "psu-err-heading" }, "Could not compute a plan:"));
    const list = el("ul", {});
    for (const e of state.errors) {
      list.appendChild(el("li", { class: "psu-error" }, e));
    }
    errBox.appendChild(list);
    section.appendChild(errBox);
  }

  if (!state.result) {
    section.appendChild(el("p", {}, "Add at least one build line to see a plan."));
    root.appendChild(section);
    return;
  }

  const r = state.result;
  const summary = el("div", { class: "psu-summary" });
  summary.appendChild(
    makeSummary(
      "Recommended PSU",
      r.recommendation.recommendedCapacityWatts === null
        ? "exceeds v1 range"
        : `${r.recommendation.recommendedCapacityWatts} W`,
    ),
  );
  summary.appendChild(
    makeSummary(
      "Required (min)",
      `${formatNumber(r.recommendation.minimumRequiredCapacityWatts, 0)} W`,
    ),
  );
  summary.appendChild(makeSummary("Controlling", r.recommendation.controllingConstraint));
  summary.appendChild(makeSummary("Idle DC", `${formatNumber(r.totals.idleDcWatts, 1)} W`));
  summary.appendChild(makeSummary("Workload DC", `${formatNumber(r.totals.workloadDcWatts, 1)} W`));
  summary.appendChild(
    makeSummary("Sustained DC", `${formatNumber(r.totals.sustainedDcWatts, 1)} W`),
  );
  summary.appendChild(
    makeSummary("Transient DC", `${formatNumber(r.totals.transientDcWatts, 1)} W`),
  );
  if (r.acPower.psuCapacityWatts !== null) {
    summary.appendChild(
      makeSummary(
        "Wall power (sustained)",
        r.acPower.sustained.acInputWatts === null
          ? "n/a"
          : `${formatNumber(r.acPower.sustained.acInputWatts, 1)} W @ ${formatNumber((r.acPower.sustained.efficiencyFraction ?? 0) * 100, 1)}%`,
      ),
    );
  }
  summary.appendChild(
    makeSummary(
      "Annual AC energy",
      r.energyCost.annualAcEnergyKwh === null
        ? "n/a"
        : `${formatNumber(r.energyCost.annualAcEnergyKwh, 1)} kWh`,
    ),
  );
  summary.appendChild(
    makeSummary("Annual cost", formatCurrency(r.energyCost.annualCost, r.energyCost.currency)),
  );
  section.appendChild(summary);

  if (r.evaluatedPsu) {
    const wrap = el("div", { class: "psu-section" });
    wrap.appendChild(
      el("h3", { style: "font-size: 0.95rem; margin: 0 0 0.25rem 0;" }, "Evaluated PSU"),
    );
    const t = el("table", { class: "psu-table" });
    const tbody = el("tbody", {});
    const rows: Array<[string, string]> = [
      ["Capacity", `${r.evaluatedPsu.capacityWatts} W`],
      ["Status", r.evaluatedPsu.status],
      ["Sustained load", `${(r.evaluatedPsu.sustainedLoadFraction * 100).toFixed(1)}%`],
      ["Transient load", `${(r.evaluatedPsu.transientLoadFraction * 100).toFixed(1)}%`],
      ["Reserve", `${formatNumber(r.evaluatedPsu.reserveWatts, 1)} W`],
    ];
    for (const [k, v] of rows) {
      const tr = el("tr", {});
      tr.appendChild(el("th", { scope: "row" }, k));
      tr.appendChild(el("td", {}, v));
      tbody.appendChild(tr);
    }
    t.appendChild(tbody);
    wrap.appendChild(t);
    section.appendChild(wrap);
  }

  if (r.warnings.length > 0) {
    const wHeading = el(
      "h3",
      { style: "font-size: 0.95rem; margin: 0.75rem 0 0.25rem 0;" },
      "Warnings and assumptions",
    );
    section.appendChild(wHeading);
    for (const w of r.warnings) {
      const box = el("div", { class: `psu-warning ${w.severity}` });
      box.appendChild(el("div", { class: "psu-code" }, `[${w.severity.toUpperCase()}] ${w.code}`));
      box.appendChild(el("div", {}, w.message));
      section.appendChild(box);
    }
  }

  const io = el("div", { class: "psu-section" });
  io.appendChild(el("h3", { style: "font-size: 0.95rem; margin: 0 0 0.25rem 0;" }, "Planner JSON"));
  const importBtn = el("input", {
    type: "file",
    accept: "application/json,.json",
    "aria-label": "Import planner JSON",
  });
  importBtn.addEventListener("change", () => importPlannerFile(importBtn, _handle));
  const exportBtn = el(
    "button",
    { type: "button", class: "psu-button psu-button-ghost" },
    "Download planner JSON",
  );
  exportBtn.addEventListener("click", () => {
    downloadJson("psu-planner-input.json", _handle.getPlannerInput());
    announce(state, "Downloaded planner JSON.");
  });
  const importLabel = el("label", { class: "psu-label" }, "Import JSON");
  io.appendChild(
    el(
      "div",
      { class: "psu-row" },
      el("div", {}, importLabel, importBtn),
      el("div", {}, exportBtn),
    ),
  );
  section.appendChild(io);

  root.appendChild(section);
}

function importPlannerFile(input: HTMLInputElement, handle: PsuWidgetHandle): void {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 1_048_576) {
    const state = (handle as unknown as { _state: WidgetState })._state;
    announce(state, "Imported file exceeds 1 MiB limit.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result ?? "");
      const json = JSON.parse(text);
      handle.setPlannerInput(json);
    } catch (err) {
      const state = (handle as unknown as { _state: WidgetState })._state;
      const message = err instanceof Error ? err.message : String(err);
      announce(state, `Invalid JSON: ${message}`);
    }
  };
  reader.readAsText(file);
}

function makeSummary(label: string, value: string): HTMLElement {
  return el(
    "div",
    {},
    el("span", { class: "psu-label" }, label),
    el("span", { class: "psu-value" }, value),
  );
}

function renderFooter(state: WidgetState, root: HTMLElement): void {
  clear(root);
  const footer = el("footer", { class: "psu-footer" });
  footer.appendChild(el("span", {}, "Open source by "));
  const pub = el(
    "a",
    { href: "https://pyralislabs.io/", rel: "noopener noreferrer", target: "_blank" },
    "Pyralis Labs",
  );
  footer.appendChild(pub);
  footer.appendChild(document.createTextNode(" · "));
  const lair = el(
    "a",
    { href: "https://localairigs.com/", rel: "noopener noreferrer", target: "_blank" },
    "Local AI Rigs",
  );
  footer.appendChild(lair);
  footer.appendChild(document.createTextNode(" · "));
  const lab = el(
    "a",
    { href: "https://minipclab.com/", rel: "noopener noreferrer", target: "_blank" },
    "MiniPCLab",
  );
  footer.appendChild(lab);
  root.appendChild(footer);
  void state;
}

function announce(state: WidgetState, message: string): void {
  state.liveMessage = message;
  const live = document.querySelector(".psu-root .psu-sr-only");
  if (live) {
    live.textContent = "";
    window.setTimeout(() => {
      live.textContent = message;
    }, 30);
  }
}

function rerender(handle: PsuWidgetHandle): void {
  const root = handle.root;
  clear(root);
  const wrap = el("div", { class: "psu-root" });
  wrap.appendChild(el("h1", { class: "psu-title" }, "PSU Power Build Planner"));
  wrap.appendChild(
    el(
      "p",
      { class: "psu-subtitle" },
      "Component-derived idle, workload, sustained, and transient DC power, PSU recommendation, and electricity cost.",
    ),
  );
  const live = createLiveRegion();
  live.textContent = (handle as unknown as { _state: WidgetState })._state.liveMessage;
  wrap.appendChild(live);

  const profileHost = el("div", {});
  const linesHost = el("div", {});
  const resultsHost = el("div", {});
  const footerHost = el("div", {});

  wrap.appendChild(profileHost);
  wrap.appendChild(linesHost);
  wrap.appendChild(resultsHost);
  wrap.appendChild(footerHost);

  const state = (handle as unknown as { _state: WidgetState })._state;
  renderProfileSection(state, profileHost, handle);
  renderLinesSection(state, linesHost, handle);
  renderResultsSection(state, resultsHost, handle);
  renderFooter(state, footerHost);
  root.appendChild(wrap);
}

export function createPsuWidget(options: PsuWidgetOptions = {}): PsuWidgetHandle {
  const state = initialState(options);
  const root = el("div", { class: "psu-shell", "data-psu-widget": "v0.1" });

  const handle: PsuWidgetHandle = {
    root,
    mount(container: HTMLElement) {
      container.appendChild(root);
      rerender(handle);
    },
    unmount() {
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      }
    },
    getPlannerInput() {
      return buildPlannerInput(state);
    },
    setPlannerInput(raw) {
      try {
        const validated = validatePlannerInput(raw);
        state.lines = validated.lines as BuildLineInput[];
        state.profile = validated.operatingProfile.preset ?? "custom";
        state.poweredHoursPerDay = validated.operatingProfile.poweredHoursPerDay;
        state.daysPerYear = validated.operatingProfile.daysPerYear ?? 365;
        state.workloadShare = validated.operatingProfile.workloadShare;
        state.fallbackUtilization = validated.operatingProfile.fallbackUtilization;
        state.ratePerKwh = validated.operatingProfile.ratePerKwh;
        state.currency = validated.operatingProfile.currency;
        state.evaluatedPsuCapacityWatts = validated.evaluatedPsuCapacityWatts ?? null;
        state.efficiencyProfileId = validated.efficiencyProfileId ?? "";
        state.efficiencyOverrideFraction = validated.efficiencyOverrideFraction ?? null;
        recompute(state);
        rerender(handle);
        announce(state, "Loaded planner JSON.");
      } catch (err) {
        if (err instanceof PlannerValidationError) {
          announce(state, `Invalid JSON: ${err.issues[0]?.message ?? err.message}`);
        } else {
          announce(state, err instanceof Error ? err.message : String(err));
        }
      }
    },
  };
  (handle as unknown as { _state: WidgetState })._state = state;
  return handle;
}
