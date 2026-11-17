import { apparatus, setup, reading, extra, specs } from "./schema.js";
import {
  results,
  engineCounter,
  pumpCounter,
  fmt,
  resultFields,
} from "./core.js";
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const value = (v) => (v == null || v === "" ? "—" : String(v));
export const summary = [
  ["Average GPM", "gpm"],
  ["Average pitot (PSI)", "pitot"],
  ["Average apparatus pressure (PSI)", "apparatusPressure"],
  ["Average test pressure (PSI)", "testPressure"],
  ["Average suction (PSI)", "suction"],
  ["Average engine counter (RPM)", "engine"],
  ["Average apparatus tach (RPM)", "tach"],
  ["Average pump counter (RPM)", "pump"],
];
export function reportGroups(d) {
  const groups = [
    [
      "Apparatus information",
      apparatus.map(([k, l]) => [l, value(d.values[k])]),
    ],
    ["Pump setup & controls", setup.map(([k, l]) => [l, value(d.values[k])])],
  ];
  d.tests.forEach((t, i) => {
    groups.push([
      `${specs[i].pct} capacity · ${specs[i].psi} PSI`,
      [
        ["Test layout", value(t.layout)],
        ["Tip size (inches)", value(t.tip)],
        ["Nozzle pressure (PSI)", value(t.nozzle)],
        ["Layout GPM", value(t.targetGpm)],
        ["Changeover valve position", value(t.position)],
      ],
    ]);
    groups.push([
      `${specs[i].pct} · Recorded readings`,
      [
        ...reading.map(([k, l]) => [l, ...t.rows.map((r) => value(r[k]))]),
        [
          "Engine counter RPM (unverified)",
          ...t.rows.map((r) => fmt(engineCounter(d, r))),
        ],
        [
          "Pump counter RPM (unverified)",
          ...t.rows.map((r) => fmt(pumpCounter(d, r, i))),
        ],
      ],
      ["Field / result", ...t.rows.map((_, j) => `Reading ${j + 1}`)],
    ]);
    groups.push([
      `${specs[i].pct} · Calculated averages (entered readings only)`,
      summary.map(([l, k]) => [l, fmt(results(d, i)[k])]),
    ]);
  });
  groups.push(
    [
      "Additional tests, comments & signature",
      extra.map(([k, l]) => [l, value(d.values[k])]),
    ],
    ["Final assessment", resultFields.map(([k, l]) => [l, value(d.values[k])])],
  );
  return groups;
}
export function reportHTML(d) {
  return `<h1>Pump Service Test Report</h1><p>${esc(d.values.department)} | Apparatus ${esc(d.values.apparatus)} | ${esc(d.values.date)}</p><p><b>Overall result (tester assessed): ${esc(d.values.overallResult || "Not assessed")}</b></p><p>Workbook validation pending. Fields, units, layout and RPM formulas have not been verified against the original Excel workbook. Blank readings are excluded from averages. Counter basis: ${esc(d.values.counterMode || "not recorded")}; retained legacy RPM arithmetic does not change with this selection.</p>${reportGroups(
    d,
  )
    .map(
      ([title, rows, headings = ["Field / result", "Value"]]) =>
        `<section><h2>${esc(title)}</h2><table><thead><tr>${headings.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td class="report-note">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`,
    )
    .join(
      "",
    )}<p>Record ID: ${esc(d.id)}. Typed signature is not a verified digital signature.</p>`;
}
export function createPDF(d) {
  if (!window.jspdf?.jsPDF)
    throw Error(
      "PDF library unavailable. Reload online once or use Print / Save as PDF.",
    );
  // Standard PDF fonts do not cover all Unicode. Never silently corrupt entered names.
  const text = JSON.stringify(reportGroups(d));
  if (/[^\u0000-\u00ff\u2013-\u201f\u2022\u2026\u20ac]/.test(text)) {
    throw Error(
      "This report contains characters outside the built-in PDF font. Use Print / Save as PDF to preserve all names and comments with your browser’s fonts.",
    );
  }
  const pdf = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
  const margin = 34;
  pdf.setProperties({
    title: `Pump Service Test ${d.values.apparatus || ""}`,
    subject: "Apparatus pump service test record",
  });
  pdf.setFontSize(19);
  pdf.text("Pump Service Test Report", margin, 44);
  pdf.autoTable({
    startY: 58,
    head: [["Department", "Apparatus", "Test date", "Tester-assessed result"]],
    body: [
      [
        value(d.values.department),
        value(d.values.apparatus),
        value(d.values.date),
        value(d.values.overallResult || "Not assessed"),
      ],
    ],
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, overflow: "linebreak" },
    headStyles: { fillColor: [25, 45, 65] },
  });
  pdf.autoTable({
    startY: pdf.lastAutoTable.finalY + 12,
    body: [
      [
        "WORKBOOK VALIDATION PENDING: Fields, units, report layout and RPM formulas are not verified against the original workbook. Averages exclude blank readings. Legacy RPM: actual counter x counter ratio; then x gear ratio. Counter basis selection does not alter that arithmetic. No automatic Pass/Fail thresholds are applied.",
      ],
    ],
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 9,
      fillColor: [250, 241, 224],
      textColor: [45, 40, 30],
    },
  });
  for (const [
    title,
    rows,
    headings = ["Field / result", "Value"],
  ] of reportGroups(d)) {
    pdf.autoTable({
      startY: pdf.lastAutoTable.finalY + 14,
      head: [[{ content: title, colSpan: headings.length }], headings],
      body: rows,
      margin: { left: margin, right: margin, top: 34, bottom: 40 },
      styles: {
        fontSize: 9,
        cellPadding: 5,
        overflow: "linebreak",
        valign: "top",
      },
      columnStyles: { 0: { cellWidth: headings.length > 2 ? 205 : 260 } },
      headStyles: { fillColor: [25, 45, 65] },
      rowPageBreak: "avoid",
    });
  }
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(80);
    pdf.text(`Pump Service Test | ${d.id} | ${i} / ${total}`, margin, 772);
  }
  return pdf.output("blob");
}
export function filename(d) {
  return (
    `pump-test-${d.values.apparatus || "apparatus"}-${d.values.date || "undated"}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    ) + ".pdf"
  );
}
export function download(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
