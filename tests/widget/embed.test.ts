import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const axeSource = readFileSync(resolve(here, "../../node_modules/axe-core/axe.min.js"), "utf8");

async function runAxe(page: Page): Promise<unknown[]> {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    type AxeAPI = {
      run: (
        context: Element | Document,
        options: Record<string, unknown>,
      ) => Promise<{ violations: unknown[] }>;
    };
    const w = window as unknown as { axe: AxeAPI };
    const result = await w.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    return result.violations;
  });
}

test.describe("widget accessibility smoke", () => {
  test("loads the widget page without console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(err.message);
    });

    const response = await page.goto("/widget.html", { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);

    await page.waitForSelector("psu-power-build-planner", { state: "attached" });
    await expect(page.locator(".psu-shell")).toBeVisible({ timeout: 10_000 });

    const filtered = consoleErrors.filter(
      (msg) =>
        !/favicon\.ico|net::ERR_FAILED/.test(msg) &&
        !/Content Security Policy[\s\S]*frame-ancestors[\s\S]*meta[\s\S]*element/i.test(msg),
    );
    expect(filtered, `unexpected console errors: ${filtered.join(" | ")}`).toEqual([]);
  });

  test("renders the planner heading and form controls", async ({ page }) => {
    await page.goto("/widget.html");
    await expect(page.locator(".psu-shell")).toBeVisible();
    const shellText = await page.locator(".psu-shell").innerText();
    expect(shellText.length).toBeGreaterThan(0);
    const controlCount = await page
      .locator('button, [role="button"], summary, input, select')
      .count();
    expect(controlCount).toBeGreaterThan(0);
  });

  test("meets WCAG 2.2 AA automated checks", async ({ page }) => {
    await page.goto("/widget.html");
    await page.waitForSelector(".psu-shell", { state: "visible" });
    const violations = await runAxe(page);
    if (Array.isArray(violations) && violations.length > 0) {
      const summary = violations
        .map((v) => {
          const r = v as {
            id: string;
            impact?: string;
            help: string;
            nodes: { target: string[] }[];
          };
          return `${r.id} (${r.impact ?? "unknown"}): ${r.help} — nodes: ${r.nodes
            .map((n) => n.target.join(","))
            .join("; ")}`;
        })
        .join("\n");
      throw new Error(`axe violations:\n${summary}`);
    }
    expect(Array.isArray(violations) ? violations : []).toEqual([]);
  });

  test("embed bundle is reachable and non-trivial", async ({ page }) => {
    const response = await page.goto("/embed.js");
    expect(response?.status()).toBe(200);
    const body = await response?.text();
    expect(body).toBeDefined();
    expect(body!.length).toBeGreaterThan(1000);
  });
});
