import { WORKBOOK_VERSION, numericColumns } from "./workbook.js";
import { specs, apparatus, setup, reading, extra } from "./schema.js";
export const STORE = "pump-service-tests-v1",
  DRAFT = "pump-service-draft-v1";
export const resultFields = [
  ["overallResult", "Overall result (assessed by tester)", "result"],
  ["resultNotes", "Result basis / exceptions", "textarea"],
];
export const required = [
  "department",
  "date",
  "apparatus",
  "pump",
  "tester",
  "signature",
  "overallResult",
];
export const number = (v) =>
  v == null ||
  typeof v === "boolean" ||
  !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(v).trim())
    ? null
    : Number.isFinite(Number(v))
      ? Number(v)
      : null;
export const fmt = (v) => (v == null ? "—" : String(Math.round(v * 100) / 100));
export function fresh() {
  return {
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    calculationVersion: WORKBOOK_VERSION,
    values: {},
    tests: specs.map((s) => ({
      layout: "",
      tip: "",
      nozzle: "",
      targetGpm: "",
      position: "",
      rows: Array.from({ length: s.count }, () => ({})),
    })),
  };
}
export const usesWorkbook = (d) => d.calculationVersion === WORKBOOK_VERSION;
const blank = (v) => v == null || String(v).trim() === "";
function product(d, a, b) {
  if (usesWorkbook(d)) {
    const x = blank(a) ? 0 : number(a),
      y = blank(b) ? 0 : number(b);
    return x === null || y === null || !Number.isFinite(x * y) ? null : x * y;
  }
  const x = number(a),
    y = number(b);
  return x === null || y === null || y <= 0 || !Number.isFinite(x * y)
    ? null
    : x * y;
}
export function engineCounter(d, r) {
  return product(d, r.actualCounter, d.values.counterRatio);
}
export function pumpCounter(d, r, i) {
  const e = engineCounter(d, r);
  return e === null ? null : product(d, e, d.values["ratio" + specs[i].psi]);
}
export function excessResults(d) {
  const engine = product(
    d,
    d.values.excessActualCounter,
    d.values.counterRatio,
  );
  return {
    engine,
    pump: engine === null ? null : product(d, engine, d.values.ratio150),
  };
}
export function cloneWithWorkbook(d) {
  const copy = structuredClone(d);
  copy.id = crypto.randomUUID();
  copy.created = new Date().toISOString();
  copy.calculationVersion = WORKBOOK_VERSION;
  delete copy.completed;
  return copy;
}
export function average(rows, key, compute) {
  const a = rows
    .map((r) => (compute ? compute(r) : number(r[key])))
    .filter((v) => v !== null && Number.isFinite(v));
  return a.length ? a.reduce((a, b) => a + b, 0) / a.length : null;
}
export function rowValues(d, r, i) {
  return Object.fromEntries(
    numericColumns.map(([, key, , input]) => [
      key,
      key === "engine"
        ? engineCounter(d, r)
        : key === "pump"
          ? pumpCounter(d, r, i)
          : number(r[input || key]),
    ]),
  );
}
export function sectionStats(d, i) {
  const rows = d.tests[i].rows.map((r) => rowValues(d, r, i)),
    totals = {},
    averages = {};
  for (const [, key] of numericColumns) {
    const values = rows
      .map((r) => r[key])
      .filter((v) => v !== null && Number.isFinite(v));
    // Excel SUM of empty raw cells is 0; AVERAGE without numbers is #DIV/0! (shown as —).
    const sum = values.reduce((a, b) => a + b, 0);
    totals[key] = Number.isFinite(sum) ? sum : null;
    averages[key] =
      values.length && Number.isFinite(sum) ? sum / values.length : null;
  }
  return { totals, averages };
}
export function results(d, i) {
  return sectionStats(d, i).averages;
}
export function entries(d) {
  const a = [...apparatus, ...setup, ...extra, ...resultFields].map(
    ([k, label, type]) => ({
      path: "values." + k,
      label,
      type,
      value: d.values[k],
    }),
  );
  d.tests.forEach((t, i) => {
    [
      ["layout", "Test layout"],
      ["tip", "Tip size (inches)"],
      ["nozzle", "Nozzle pressure (PSI)", "number"],
      ["targetGpm", "Layout GPM", "number"],
      ["position", "Pump changeover valve position"],
    ].forEach(([k, label, type]) =>
      a.push({ path: `tests.${i}.${k}`, label, type, value: t[k] }),
    );
    t.rows.forEach((r, j) =>
      reading.forEach(([k, label, type]) =>
        a.push({ path: `tests.${i}.rows.${j}.${k}`, label, type, value: r[k] }),
      ),
    );
  });
  return a;
}
export function issues(d) {
  const out = [];
  for (const k of required) {
    if (!String(d.values[k] ?? "").trim())
      out.push({
        path: "values." + k,
        message: `${[...apparatus, ...setup, ...extra, ...resultFields].find((f) => f[0] === k)[1]} is required to complete a test.`,
      });
  }
  for (const f of entries(d)) {
    if (
      f.type === "number" &&
      f.value !== "" &&
      f.value != null &&
      number(f.value) === null
    )
      out.push({
        path: f.path,
        message: `${f.label} must be a finite number.`,
      });
    if (
      /values\.(counterRatio|ratio150|ratio200|ratio250)$/.test(f.path) &&
      number(f.value) !== null &&
      number(f.value) <= 0
    )
      out.push({
        path: f.path,
        message: `${f.label} must be greater than zero.`,
      });
    if (f.type === "date" && f.value && !validDate(f.value))
      out.push({ path: f.path, message: "Enter a valid test date." });
  }
  if (d.values.overallResult === "Pass" || d.values.overallResult === "Fail") {
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < d.tests[i].rows.length; j++)
        for (const k of ["time", "gpm", "testPressure"])
          if (!String(d.tests[i].rows[j][k] ?? "").trim())
            out.push({
              path: `tests.${i}.rows.${j}.${k}`,
              message: `${specs[i].pct}, reading ${j + 1}: ${k} is required for a Pass/Fail record.`,
            });
  }
  return out;
}
function validDate(v) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v
  );
}
export function validateRecord(d) {
  if (
    !d ||
    typeof d !== "object" ||
    typeof d.id !== "string" ||
    !d.id ||
    d.id.length > 200 ||
    !d.values ||
    Array.isArray(d.values) ||
    typeof d.values !== "object" ||
    !Array.isArray(d.tests) ||
    d.tests.length !== 3
  )
    throw Error("Invalid test record");
  if (d.calculationVersion != null && d.calculationVersion !== WORKBOOK_VERSION)
    throw Error(
      "Unsupported calculation version; update the app before importing this record.",
    );
  const scalar = (v) =>
    typeof v === "string" ||
    (typeof v === "number" && Number.isFinite(v)) ||
    v === null;
  if (
    Object.keys(d.values).length > 300 ||
    !Object.values(d.values).every(scalar)
  )
    throw Error("Invalid field values");
  d.tests.forEach((t, i) => {
    if (
      !t ||
      !Array.isArray(t.rows) ||
      t.rows.length !== specs[i].count ||
      !Object.entries(t)
        .filter(([k]) => k !== "rows")
        .every(([, v]) => scalar(v)) ||
      !t.rows.every(
        (r) =>
          r &&
          typeof r === "object" &&
          !Array.isArray(r) &&
          Object.keys(r).length <= 100 &&
          Object.values(r).every(scalar),
      )
    )
      throw Error("Invalid reading structure");
  });
  return d;
}
export function parseBackup(text) {
  const raw = JSON.parse(text);
  const list = Array.isArray(raw)
    ? raw
    : raw?.format === "pump-service-backup" && raw.version === 2
      ? raw.tests
      : null;
  if (!Array.isArray(list) || list.length > 10000)
    throw Error("Unsupported backup format");
  list.forEach(validateRecord);
  const ids = new Set();
  for (const d of list) {
    if (ids.has(d.id)) throw Error("Duplicate test IDs in backup");
    ids.add(d.id);
  }
  return {
    tests: list,
    draft: !Array.isArray(raw) && raw.draft ? validateRecord(raw.draft) : null,
  };
}
export function mergeHistory(current, incoming) {
  const map = new Map(current.map((d) => [d.id, d]));
  let conflicts = 0;
  for (const d of incoming) {
    if (!map.has(d.id)) map.set(d.id, d);
    else if (JSON.stringify(map.get(d.id)) !== JSON.stringify(d)) {
      const id = d.id + "-import-" + crypto.randomUUID();
      map.set(id, { ...d, id });
      conflicts++;
    }
  }
  return { tests: [...map.values()], conflicts };
}
