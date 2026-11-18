import { apparatus, setup, reading, extra, specs } from "./schema.js";
import {
  results,
  sectionStats,
  rowValues,
  excessResults,
  fmt,
  resultFields,
  usesWorkbook,
} from "./core.js";
import { numericColumns, finalRows } from "./workbook.js";
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const value = (v) => (v == null || v === "" ? "—" : String(v));
export const summary = numericColumns.map(([, k, l]) => ["Average " + l, k]);
export function calculationNote(d) {
  return usesWorkbook(d)
    ? "June 2026 workbook formulas: counter engine = actual counter x counter ratio; counter pump = counter engine x section gear ratio. Blank factors produce zero; calculated RPM zeros count in averages. Blank raw readings are excluded from averages; an empty raw average is shown as — instead of #DIV/0!. Invalid inputs produce no derived result. No automatic Pass/Fail thresholds."
    : "LEGACY RECORD: pre-workbook calculation behavior retained. Blank counter inputs are excluded from RPM averages. This record has not been converted to workbook blank/zero behavior.";
}
function pairs(fields, values) {
  const rows = [];
  for (let i = 0; i < fields.length; i += 2) {
    const a = fields[i],
      b = fields[i + 1];
    rows.push([
      a[1],
      value(values[a[0]]),
      b ? b[1] : "",
      b ? value(values[b[0]]) : "",
    ]);
  }
  return rows;
}
const pairHead = ["Field", "Value", "Field", "Value"];
const layoutFields = [
  ["layout", "Test layout"],
  ["tip", "Tip size (inches)"],
  ["nozzle", "Nozzle pressure (PSI)"],
  ["targetGpm", "Layout GPM"],
  ["position", "Changeover valve position"],
];
export function reportGroups(d) {
  const groups = [
    ["Apparatus information", pairs(apparatus, d.values), pairHead],
    ["Pump setup & controls", pairs(setup, d.values), pairHead],
  ];
  d.tests.forEach((t, i) => {
    const name = `${specs[i].name} · ${specs[i].pct} at ${specs[i].psi} PSI`;
    groups.push([name + " · Layout", pairs(layoutFields, t), pairHead]);
    const stat = sectionStats(d, i);
    const rows = t.rows.map((r, j) => {
      const vals = rowValues(d, r, i);
      return [
        value(r.time),
        ...numericColumns.map(([, k, , input]) =>
          k === "engine" || k === "pump" ? fmt(vals[k]) : value(r[input || k]),
        ),
        value(r.actualCounter),
      ];
    });
    rows.push(
      ["Totals", ...numericColumns.map(([, k]) => fmt(stat.totals[k])), ""],
      ["Average", ...numericColumns.map(([, k]) => fmt(stat.averages[k])), ""],
    );
    // The workbook's A:M/O row order, including totals and averages, is retained.
    groups.push([
      name + " · Recorded readings",
      rows,
      [
        "Time",
        "Counter pump RPM",
        "Counter engine RPM",
        "Apparatus tach RPM",
        "Pump PSI apparatus",
        "Pump PSI test",
        "Actual suction PSI",
        "Pitot PSI",
        "GPM",
        "Voltage",
        "Trans. temp.",
        "Oil PSI",
        "Water temp.",
        "Actual counter",
      ],
    ]);
    if (i === 0) {
      const e = excessResults(d);
      groups.push([
        "5-minute excess power test",
        [
          ...pairs(
            extra.filter(([k]) => k.startsWith("excess")),
            d.values,
          ),
          [
            "Counter pump speed (RPM), J29",
            fmt(e.pump),
            "Counter engine speed (RPM), O29",
            fmt(e.engine),
          ],
        ],
        pairHead,
      ]);
    }
  });
  groups.push(
    [
      "Final results (workbook rows 52–61)",
      finalRows.map(([l, k]) => [
        l,
        ...d.tests.map((t, i) =>
          k === "tip" || k === "position" ? value(t[k]) : fmt(results(d, i)[k]),
        ),
      ]),
      ["Result", "150 PSI", "200 PSI", "250 PSI"],
    ],
    [
      "Comments & sign-off",
      extra
        .filter(([k]) => !k.startsWith("excess"))
        .map(([k, l]) => [l, value(d.values[k])]),
    ],
    [
      "Overall assessment",
      resultFields.map(([k, l]) => [l, value(d.values[k])]),
    ],
  );
  return groups;
}
export function reportHTML(d) {
  return `<h1>Pump Service Test Report</h1><p>${esc(d.values.department)} | Apparatus ${esc(d.values.apparatus)} | ${esc(d.values.date)}</p><p><b>Overall result (tester assessed): ${esc(d.values.overallResult || "Not assessed")}</b></p><p>${esc(calculationNote(d))}</p>${reportGroups(
    d,
  )
    .map(
      ([title, rows, headings = ["Field", "Value"]]) =>
        `<section><h2>${esc(title)}</h2><table class="${headings.length > 4 ? "reading-report" : ""}"><thead><tr>${headings.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td class="report-note">${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`,
    )
    .join(
      "",
    )}<p>Sheet attestation: All Test Results are Accurate &amp; Correct. Signature is the tester’s typed name, not a verified digital signature.</p><p>Record ID: ${esc(d.id)}</p>`;
}
export function createPDF(d) {
  if (!window.jspdf?.jsPDF)
    throw Error(
      "PDF library unavailable. Reload online once or use Print / Save as PDF.",
    );
  const text = JSON.stringify(reportGroups(d));
  if (/[^\u0000-\u00ff\u2013-\u201f\u2022\u2026\u20ac]/.test(text))
    throw Error(
      "This report contains characters outside the built-in PDF font. Use Print / Save as PDF to preserve all names and comments with your browser’s fonts.",
    );
  const pdf = new window.jspdf.jsPDF({ unit: "pt", format: "letter" }),
    margin = 30;
  pdf.setProperties({
    title: `Pump Service Test ${d.values.apparatus || ""}`,
    subject: "Apparatus pump service test record",
  });
  pdf.setFontSize(18);
  pdf.text("Pump Service Test Report", margin, 40);
  pdf.autoTable({
    startY: 50,
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
    styles: { fontSize: 8, overflow: "linebreak" },
    headStyles: { fillColor: [25, 45, 65] },
  });
  pdf.autoTable({
    startY: pdf.lastAutoTable.finalY + 8,
    body: [[calculationNote(d)]],
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      fillColor: [250, 241, 224],
      textColor: [45, 40, 30],
    },
  });
  for (const [title, rows, headings = ["Field", "Value"]] of reportGroups(d)) {
    const wide = headings.length > 4,
      paired = headings === pairHead;
    pdf.autoTable({
      startY: pdf.lastAutoTable.finalY + 10,
      head: [[{ content: title, colSpan: headings.length }], headings],
      body: rows,
      margin: { left: margin, right: margin, top: 30, bottom: 40 },
      styles: {
        fontSize: wide ? 6.5 : 8,
        cellPadding: wide ? 3 : 4,
        overflow: "linebreak",
        valign: "top",
      },
      columnStyles: wide
        ? { 0: { cellWidth: 36 }, 13: { cellWidth: 40 } }
        : paired
          ? { 0: { cellWidth: 130 }, 2: { cellWidth: 130 } }
          : { 0: { cellWidth: 245 } },
      headStyles: { fillColor: [25, 45, 65] },
      rowPageBreak: "avoid",
      pageBreak: wide ? "avoid" : "auto",
    });
  }
  pdf.autoTable({
    startY: pdf.lastAutoTable.finalY + 10,
    body: [
      [
        "Sheet attestation: All Test Results are Accurate & Correct. Typed signature records the tester's name; it is not a verified digital signature.",
      ],
    ],
    margin: { left: margin, right: margin, top: 30, bottom: 40 },
    styles: { fontSize: 8 },
  });
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
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
