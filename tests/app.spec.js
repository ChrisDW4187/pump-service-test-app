import { test, expect } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "node:fs/promises";
const set = async (page, path, value) => {
  await page.locator(`[data-path="${path}"]`).fill(value);
};
async function seedComplete(page) {
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("pump-service-draft-v1"));
    Object.assign(d.values, {
      department: "Test Fire Department",
      apparatus: "Engine 4187",
      date: "2026-11-17",
      pump: "Test Pump",
      tester: "Firefighter Smith",
      signature: "A Smith",
      overallResult: "Incomplete",
      comments: "COMMENTS-END-123",
      resultNotes: "Incomplete training record",
    });
    for (const t of d.tests)
      for (const r of t.rows) {
        r.gpm = "1500";
        r.pitot = "60";
      }
    localStorage.setItem("pump-service-draft-v1", JSON.stringify(d));
  });
  await page.reload();
}
test("mobile draft autosaves immediately, navigation and new test retain history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await set(page, "values.department", "Draft FD");
  await page.reload();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Draft FD",
  );
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Draft FD",
  );
  await seedComplete(page);
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Save completed test", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("pump-service-tests-v1")).length,
      ),
    )
    .toBe(1);
  page.once("dialog", (d) => d.accept());
  await page.locator("#newTest").click();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue("");
  await page.locator("#historyBtn").click();
  await page.locator("#search").fill("4187");
  await expect(page.locator("#historyRows")).toContainText("Engine 4187");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Test Fire Department",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("validation blocks completion without deleting data; numeric typing keeps focus", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "3. 100% capacity", exact: true })
    .click();
  const input = page.locator('[data-path="tests.0.rows.0.gpm"]');
  await input.pressSequentially("bad");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save completed test", exact: true })
    .click();
  await expect(page.locator(".errors")).toContainText(
    "must be a finite number",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pump-service-draft-v1")).tests[0]
          .rows[0].gpm,
    ),
  ).toBe("bad");
});
test("PDF downloads, contains end comments and calculated values; sharing fallback downloads", async ({
  page,
}) => {
  await page.goto("/");
  await seedComplete(page);
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const dl = await pending;
  const bytes = new Uint8Array(await fs.readFile(await dl.path()));
  const pdf = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    expect(p.view[2]).toBe(612);
    expect(p.view[3]).toBe(792);
    text += (await p.getTextContent()).items.map((x) => x.str).join(" ");
  }
  expect(text).toContain("COMMENTS-END-123");
  expect(text).toContain("1500");
  expect(text).toContain("A Smith");
  expect(text).toContain("Incomplete");
  expect(text).toContain("Reading 5");
  expect(text).toContain("WORKBOOK VALIDATION PENDING");
  page.once("dialog", (d) => d.accept());
  const fallback = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share Report", exact: true }).click();
  await fallback;
});
test("native sharing receives PDF file", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = async (o) => {
      window.shared = {
        name: o.files[0].name,
        type: o.files[0].type,
        size: o.files[0].size,
      };
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  await page.getByRole("button", { name: "Share Report", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.shared?.type))
    .toBe("application/pdf");
  expect(await page.evaluate(() => window.shared.size)).toBeGreaterThan(1000);
});
test("offline navigation and reload preserve draft and PDF assets", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.locator("#network")).toContainText("Offline ready");
  await page.reload();
  await set(page, "values.department", "Offline FD");
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Offline FD",
  );
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  await download;
  await context.setOffline(false);
});
test("backup export/import round trip, invalid import leaves records unchanged", async ({
  page,
}) => {
  await page.goto("/");
  await seedComplete(page);
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Save completed test", exact: true })
    .click();
  await page.locator("#historyBtn").click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Export backup (history + draft)",
      exact: true,
    })
    .click();
  const file = await (await downloading).path();
  await page.evaluate(() => localStorage.removeItem("pump-service-tests-v1"));
  await page.reload();
  await page.locator("#historyBtn").click();
  const handler = (d) => d.accept();
  page.on("dialog", handler);
  await page.locator("#importFile").setInputFiles(file);
  await expect(page.locator("#historyRows")).toContainText("Engine 4187");
  await page.locator("#importFile").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('[{"id":"broken","values":{},"tests":[]}]'),
  });
  await expect(page.locator("#historyRows")).toContainText("Engine 4187");
  page.off("dialog", handler);
});
test("storage failures show warning and retain entered values", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await set(page, "values.department", "Do not lose this");
  await expect(page.locator("#storageError")).toBeVisible();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Do not lose this",
  );
});
test("all form fields render on phone tablet and desktop with no page overflow", async ({
  page,
}) => {
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (let i = 0; i < 7; i++) {
      await page.locator(`[data-step="${i}"]`).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const input of await page.locator("[data-path]").all()) {
        await expect(input).toBeVisible();
        expect((await input.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test("every form input persists across section changes and reload", async ({
  page,
}) => {
  await page.goto("/");
  const expected = {};
  for (let i = 0; i < 7; i++) {
    await page.locator(`[data-step="${i}"]`).click();
    for (const input of await page.locator("[data-path]").all()) {
      const path = await input.getAttribute("data-path");
      const tag = await input.evaluate((el) => el.tagName);
      let value;
      if (tag === "SELECT") {
        value = await input
          .locator("option")
          .evaluateAll((opts) => opts.find((o) => o.value)?.value);
        await input.selectOption(value);
      } else {
        value =
          (await input.getAttribute("type")) === "date"
            ? "2026-11-17"
            : (await input.getAttribute("data-number"))
              ? "123.5"
              : `Value ${path}`;
        await input.fill(value);
      }
      expected[path] = value;
    }
  }
  await page.reload();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("pump-service-draft-v1")),
  );
  for (const [path, value] of Object.entries(expected)) {
    let o = saved;
    for (const k of path.split(".")) o = o[k];
    expect(o, path).toBe(value);
  }
  expect(Object.keys(expected).length).toBeGreaterThan(190);
});
test("corrupt storage is protected and raw recovery offered", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("pump-service-tests-v1", "BROKEN-RECORDS");
  });
  await page.goto("/");
  await expect(page.locator("#storageError")).toContainText(
    "could not be read",
  );
  await set(page, "values.department", "new draft");
  expect(
    await page.evaluate(() => localStorage.getItem("pump-service-tests-v1")),
  ).toBe("BROKEN-RECORDS");
  await page.locator("#historyBtn").click();
  await expect(
    page.getByRole("button", { name: "Export raw recovery data" }),
  ).toBeVisible();
});
test("another tab pauses writes instead of overwriting draft", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await set(page, "values.department", "Tab one");
  const other = await context.newPage();
  await other.goto("/");
  await expect(page.locator("#storageError")).toContainText("Another app tab");
  await set(page, "values.department", "Unsaved local edit");
  expect(
    await other.evaluate(
      () =>
        JSON.parse(localStorage.getItem("pump-service-draft-v1")).values
          .department,
    ),
  ).toBe("Tab one");
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Unsaved local edit",
  );
});
test("Pages subdirectory install scope, offline reload and assets", async ({
  page,
  context,
}) => {
  await page.goto("http://127.0.0.1:4174/pump-service-test-app/");
  await expect(page.locator("#network")).toContainText("Offline ready");
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  expect(scope).toBe("http://127.0.0.1:4174/pump-service-test-app/");
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#newTest")).toBeVisible();
  await context.setOffline(false);
});
test("long comments paginate without losing the final text", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("pump-service-draft-v1"));
    d.values.comments =
      "Long comment content. ".repeat(1200) + " FINAL-COMMENT-END";
    localStorage.setItem("pump-service-draft-v1", JSON.stringify(d));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const pdf = await getDocument({
    data: new Uint8Array(await fs.readFile(await (await pending).path())),
    useSystemFonts: true,
  }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    text += (await p.getTextContent()).items.map((x) => x.str).join(" ");
  }
  expect(text).toContain("FINAL-COMMENT-END");
});
test("cancel new test and native sharing preserve the active draft", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = async () => {
      throw new DOMException("Cancelled", "AbortError");
    };
  });
  await page.goto("/");
  await set(page, "values.department", "Keep draft");
  page.once("dialog", (d) => d.dismiss());
  await page.locator("#newTest").click();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Keep draft",
  );
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  const downloads = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: "Share Report", exact: true }).click();
  await page.getByRole("button", { name: "1. Apparatus", exact: true }).click();
  await expect(page.locator('[data-path="values.department"]')).toHaveValue(
    "Keep draft",
  );
  expect(downloads).toHaveLength(0);
});

test("print action builds complete escaped report and unicode PDF asks for browser print", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      window.printCalled = true;
    };
  });
  await page.goto("/");
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("pump-service-draft-v1"));
    d.values.comments = "<script>danger</script> 張";
    localStorage.setItem("pump-service-draft-v1", JSON.stringify(d));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "7. Final results", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Print / Save as PDF", exact: true })
    .click();
  expect(await page.evaluate(() => window.printCalled)).toBe(true);
  await expect(page.locator("#printReport")).toContainText(
    "<script>danger</script> 張",
  );
  expect(await page.locator("#printReport script").count()).toBe(0);
  const dialog = page.waitForEvent("dialog");
  const clicking = page
    .getByRole("button", { name: "Download PDF", exact: true })
    .click();
  const warning = await dialog;
  expect(warning.message()).toContain("Print / Save as PDF");
  await warning.accept();
  await clicking;
});
