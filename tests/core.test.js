import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  number,
  average,
  engineCounter,
  pumpCounter,
  results,
  issues,
  parseBackup,
  mergeHistory,
  entries,
} from "../core.js";
import { apparatus, setup, extra, reading } from "../schema.js";
import { reportGroups } from "../report.js";
test("fresh tests are blank and independently allocated", () => {
  const a = fresh(),
    b = fresh();
  assert.deepEqual(a.values, {});
  assert.notEqual(a.id, b.id);
  assert.deepEqual(
    a.tests.map((t) => t.rows.length),
    [5, 3, 3],
  );
  a.tests[0].rows[0].gpm = "1";
  assert.deepEqual(a.tests[0].rows[1], {});
  assert.equal(b.tests[0].rows[0].gpm, undefined);
});
test("numbers and averages preserve zero and signed readings, exclude blanks and invalid values", () => {
  assert.equal(number("0"), 0);
  for (const v of ["", null, "abc", "Infinity"]) assert.equal(number(v), null);
  assert.equal(
    average([{ x: "0" }, { x: "10" }, { x: "" }, { x: "bad" }], "x"),
    5,
  );
  assert.equal(average([{}], "x"), null);
  assert.equal(average([{ x: "-5" }, { x: "5" }], "x"), 0);
});
test("retained legacy RPM arithmetic and averages", () => {
  let d = fresh();
  delete d.calculationVersion;
  d.values = { counterRatio: "2", ratio150: "1.5" };
  d.tests[0].rows[0] = { actualCounter: "1000", gpm: "1500" };
  d.tests[0].rows[1] = { actualCounter: "1200", gpm: "1400" };
  assert.equal(engineCounter(d, d.tests[0].rows[0]), 2000);
  assert.equal(pumpCounter(d, d.tests[0].rows[0], 0), 3000);
  assert.equal(results(d, 0).engine, 2200);
  assert.equal(results(d, 0).gpm, 1450);
  d.values.counterRatio = "";
  assert.equal(results(d, 0).engine, null);
  d.values.counterRatio = "0";
  assert.equal(engineCounter(d, { actualCounter: "5" }), null);
});
test("validation flags required and invalid data without mutating it", () => {
  const d = fresh();
  d.values.ratio150 = "-1";
  d.tests[0].rows[0].gpm = "oops";
  const before = JSON.stringify(d);
  assert.ok(issues(d).some((i) => i.path === "values.department"));
  assert.ok(issues(d).some((i) => i.path === "values.ratio150"));
  assert.ok(issues(d).some((i) => i.path === "tests.0.rows.0.gpm"));
  assert.equal(JSON.stringify(d), before);
  d.values.date = "2026-02-30";
  assert.ok(issues(d).some((i) => i.message.includes("valid test date")));
});
test("each legacy form field and computed reading appears in report", () => {
  const d = fresh();
  for (const f of entries(d)) {
    const p = f.path.split(".");
    let o = d;
    for (const k of p.slice(0, -1)) o = o[k];
    o[p.at(-1)] = `MARKER_${f.path}`;
  }
  const report = JSON.stringify(reportGroups(d));
  for (const f of entries(d)) assert.ok(report.includes(f.value), f.path);
  assert.equal(
    entries(d).length,
    apparatus.length +
      setup.length +
      extra.length +
      2 +
      3 * 5 +
      11 * reading.length,
  );
});
test("legacy and v2 backups accepted, malformed readings rejected atomically", () => {
  const d = fresh();
  assert.equal(parseBackup(JSON.stringify([d])).tests.length, 1);
  assert.equal(
    parseBackup(
      JSON.stringify({
        format: "pump-service-backup",
        version: 2,
        tests: [d],
        draft: d,
      }),
    ).draft.id,
    d.id,
  );
  for (const v of [
    {},
    [{ id: "x", values: {}, tests: [] }],
    { format: "other", tests: [] },
  ])
    assert.throws(() => parseBackup(JSON.stringify(v)));
  const bad = structuredClone(d);
  bad.tests[0].rows.pop();
  assert.throws(() => parseBackup(JSON.stringify([bad])));
});
test("merge never overwrites conflicts and retains existing histories", () => {
  const d = fresh(),
    changed = structuredClone(d);
  changed.values.comments = "changed";
  assert.equal(mergeHistory([d], [d]).tests.length, 1);
  const r = mergeHistory([d], [changed]);
  assert.equal(r.tests.length, 2);
  assert.equal(r.tests[0].values.comments, undefined);
  assert.equal(r.tests[1].values.comments, "changed");
  assert.equal(r.conflicts, 1);
});

test("legacy average columns use only valid readings", () => {
  const d = fresh();
  delete d.calculationVersion;
  for (let i = 0; i < 3; i++) {
    d.values["ratio" + [150, 200, 250][i]] = "1.25";
    d.values.counterRatio = "2";
    d.tests[i].rows[0] = {
      pitot: "0",
      gpm: "1000",
      apparatusPressure: "140",
      testPressure: "150",
      suction: "-5",
      actualCounter: "500",
      apparatusTach: "1000",
    };
    d.tests[i].rows[1] = {
      pitot: "80",
      gpm: "1100",
      apparatusPressure: "160",
      testPressure: "170",
      suction: "-7",
      actualCounter: "600",
      apparatusTach: "1200",
    };
    assert.deepEqual(results(d, i), {
      pitot: 40,
      gpm: 1050,
      apparatusPressure: 150,
      testPressure: 160,
      suction: -6,
      engine: 1100,
      tach: 1100,
      pump: 1375,
      voltage: null,
      transTemp: null,
      oilPressure: null,
      waterTemp: null,
    });
  }
});
test("Pass/Fail needs readings, while Incomplete can document an interrupted test", () => {
  const d = fresh();
  d.values = {
    department: "FD",
    date: "2026-11-17",
    apparatus: "1",
    pump: "Pump",
    tester: "Tester",
    signature: "Signed",
    overallResult: "Incomplete",
  };
  assert.equal(issues(d).length, 0);
  d.values.overallResult = "Pass";
  assert.equal(issues(d).length, 33);
  for (const t of d.tests)
    for (const r of t.rows)
      Object.assign(r, { time: "09:00", gpm: "100", testPressure: "150" });
  assert.equal(issues(d).length, 0);
});
