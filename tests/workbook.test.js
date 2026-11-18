import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  WORKBOOK_SOURCE,
  WORKBOOK_VERSION,
  sections,
  numericColumns,
  finalRows,
} from "../workbook.js";
import {
  fresh,
  engineCounter,
  pumpCounter,
  sectionStats,
  excessResults,
  results,
  entries,
  cloneWithWorkbook,
  validateRecord,
  parseBackup,
} from "../core.js";
import { reportGroups, reportHTML } from "../report.js";
const reference = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/workbook-reference.json", import.meta.url),
  ),
);
const fixtures = JSON.parse(
  fs.readFileSync(new URL("./fixtures/workbook-cases.json", import.meta.url)),
);
test("source identity, all 126 formulas and every workbook input have a field mapping", () => {
  assert.deepEqual(WORKBOOK_SOURCE, reference.source);
  assert.equal(Object.keys(reference.formulas).length, 126);
  const paths = new Set(entries(fresh()).map((f) => f.path));
  for (const path of Object.keys(reference.inputCells))
    assert.ok(paths.has(path), path);
  for (const f of entries(fresh()))
    assert.ok(
      reference.inputCells[f.path] ||
        reference.appOnlyFields.includes(f.path.split(".").at(-1)),
      f.path,
    );
});
function outputs(d) {
  const out = {};
  sections.forEach((s, i) => {
    d.tests[i].rows.forEach((r, j) => {
      out["B" + (s.first + j)] = pumpCounter(d, r, i);
      out["C" + (s.first + j)] = engineCounter(d, r);
    });
    const stat = sectionStats(d, i);
    for (const [column, key] of numericColumns) {
      out[column + s.total] = stat.totals[key];
      out[column + s.average] = stat.averages[key];
    }
    for (let j = 0; j < finalRows.length; j++) {
      const key = finalRows[j][1];
      out[["K", "M", "O"][i] + (52 + j)] =
        key === "tip" || key === "position"
          ? d.tests[i][key]
          : results(d, i)[key];
    }
  });
  const excess = excessResults(d);
  out.J29 = excess.pump;
  out.O29 = excess.engine;
  return out;
}
for (const fixture of fixtures.cases)
  test(`all workbook formulas: ${fixture.name} (${fixture.engine || "LibreOffice reference"})`, () => {
    const actual = outputs(fixture.record);
    assert.equal(Object.keys(actual).length, 126);
    for (const [cell, expected] of Object.entries(fixture.expected)) {
      const value = actual[cell];
      if (expected === "#DIV/0!")
        assert.equal(value, null, cell + " empty average");
      else if (typeof expected === "number")
        assert.ok(
          typeof value === "number" ||
            (typeof value === "string" && value.trim() !== ""),
          cell + " numeric",
        );
      if (typeof expected === "number")
        assert.ok(
          Math.abs(Number(value) - expected) < 1e-8,
          `${cell}: ${value} vs ${expected}`,
        );
      else if (expected !== "#DIV/0!") assert.equal(value, expected, cell);
    }
  });
test("partial RPM averages include workbook zero rows, raw averages ignore blanks", () => {
  const d = fresh();
  d.values = { counterRatio: "2", ratio150: "1.5" };
  d.tests[0].rows[0] = { actualCounter: "1000", gpm: "1500" };
  const s = sectionStats(d, 0);
  assert.equal(s.totals.engine, 2000);
  assert.equal(s.averages.engine, 400);
  assert.equal(s.averages.pump, 600);
  assert.equal(s.averages.gpm, 1500);
  assert.equal(s.averages.voltage, null);
  assert.equal(s.totals.voltage, 0);
});
test("invalid inputs do not become workbook zero and invalid derived inputs do not propagate", () => {
  const d = fresh();
  d.values.counterRatio = "2";
  d.values.ratio150 = "3";
  assert.equal(engineCounter(d, {}), 0);
  assert.equal(engineCounter(d, { actualCounter: "bad" }), null);
  assert.equal(pumpCounter(d, { actualCounter: "bad" }, 0), null);
  assert.equal(
    excessResults({
      ...d,
      values: { counterRatio: "bad", excessActualCounter: "2", ratio150: "3" },
    }).pump,
    null,
  );
});
test("legacy history and import behavior remain unchanged; workbook conversion creates a new record", () => {
  const old = fresh();
  delete old.calculationVersion;
  old.completed = "saved";
  old.values = { counterRatio: "2", ratio150: "1.5" };
  old.tests[0].rows[0] = { actualCounter: "1000" };
  assert.equal(results(old, 0).engine, 2000);
  const serialized = JSON.stringify(old),
    copy = cloneWithWorkbook(old);
  assert.notEqual(copy.id, old.id);
  assert.equal(copy.calculationVersion, WORKBOOK_VERSION);
  assert.equal(results(copy, 0).engine, 400);
  assert.equal(copy.completed, undefined);
  assert.equal(JSON.stringify(old), serialized);
  const imported = parseBackup(JSON.stringify([old])).tests[0];
  assert.equal(imported.calculationVersion, undefined);
  assert.equal(results(imported, 0).engine, 2000);
  assert.throws(() =>
    validateRecord({ ...copy, calculationVersion: "future-version" }),
  );
});
test("report uses worksheet sequence, totals, all averages and excess speeds", () => {
  const groups = reportGroups(fresh());
  const names = groups.map((g) => g[0]);
  assert.ok(
    names.indexOf("5-minute excess power test") >
      names.findIndex(
        (n) => n.startsWith("First Test") && n.includes("readings"),
      ),
  );
  assert.ok(
    names.indexOf("5-minute excess power test") <
      names.findIndex((n) => n.startsWith("Second Test")),
  );
  for (const group of groups.filter((g) =>
    g[0].includes("Recorded readings"),
  )) {
    assert.equal(group[2].length, 14);
    assert.equal(group[1].at(-2)[0], "Totals");
    assert.equal(group[1].at(-1)[0], "Average");
  }
  assert.ok(reportHTML(fresh()).includes("All Test Results are Accurate"));
});
