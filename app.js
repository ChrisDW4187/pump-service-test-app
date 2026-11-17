import { apparatus, setup, reading, extra, specs } from "./schema.js";
import {
  STORE,
  DRAFT,
  fresh,
  fmt,
  results,
  engineCounter,
  pumpCounter,
  issues,
  required,
  resultFields,
  validateRecord,
  parseBackup,
  mergeHistory,
} from "./core.js";
import {
  esc,
  summary,
  reportHTML,
  createPDF,
  filename,
  download,
} from "./report.js";
const $ = (id) => document.getElementById(id),
  steps = [
    "Apparatus",
    "Pump & setup",
    "100% capacity",
    "70% capacity",
    "50% capacity",
    "Additional tests",
    "Final results",
    "History",
  ];
let data = fresh(),
  history = [],
  step = 0,
  showErrors = false,
  search = "",
  storageBlocked = false,
  readFailed = false,
  externalConflict = false;
function storageError(message) {
  $("storageError").hidden = false;
  $("storageError").textContent = message;
  $("saveStatus").textContent = "Not saved — export a backup now";
}
try {
  const h = localStorage.getItem(STORE),
    d = localStorage.getItem(DRAFT);
  if (h) {
    const candidate = JSON.parse(h);
    if (!Array.isArray(candidate)) throw Error("Invalid history");
    candidate.forEach(validateRecord);
    history = candidate;
  }
  if (d) data = validateRecord(JSON.parse(d));
} catch (e) {
  storageBlocked = true;
  readFailed = true;
  storageError(
    "Local records could not be read. Existing storage has not been overwritten. Export recovery data below before changing browsers or clearing storage. " +
      e.message,
  );
}
function write(key, v) {
  if (externalConflict) {
    storageError(
      "Another app tab changed local records. Export this tab’s backup, close other tabs, and reload before continuing. Saving is paused to prevent overwriting records.",
    );
    return false;
  }
  if (readFailed) {
    storageError(
      "Storage is protected because existing records could not be read. Export recovery data and contact your maintainer.",
    );
    return false;
  }
  try {
    localStorage.setItem(key, JSON.stringify(v));
    storageBlocked = false;
    return true;
  } catch (e) {
    storageBlocked = true;
    storageError(
      "Device storage failed. Entries remain open in memory. Export a backup now; do not close this page. " +
        e.message,
    );
    return false;
  }
}
function persist() {
  data.updated = new Date().toISOString();
  if (write(DRAFT, data)) {
    $("saveStatus").textContent =
      "Draft saved on this device · " +
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    $("storageError").hidden = true;
  }
}
function field([k, l, t], v, p = "values.") {
  const path = p + k,
    opts =
      t === "pass"
        ? ["", "P", "F"]
        : t === "source"
          ? ["", "Draft", "Hydrant"]
          : t === "counter"
            ? ["", "engine", "pump"]
            : t === "result"
              ? ["", "Pass", "Fail", "Incomplete", "Not assessed"]
              : null;
  const invalid =
    (showErrors ||
      ((t === "number" || t === "date") && v != null && v !== "")) &&
    issues(data).some((e) => e.path === path);
  return `<label class="field">${esc(l)}${required.includes(k) ? " *" : ""}${opts ? `<select data-path="${path}" aria-invalid="${invalid}">${opts.map((x) => `<option value="${esc(x)}" ${v === x ? "selected" : ""}>${esc(x || "Select…")}</option>`).join("")}</select>` : t === "textarea" ? `<textarea data-path="${path}">${esc(v)}</textarea>` : `<input data-path="${path}" type="${t === "date" ? "date" : "text"}" ${t === "number" ? 'inputmode="decimal" data-number="true"' : ""} value="${esc(v)}" aria-invalid="${invalid}" autocomplete="off">`}</label>`;
}
function grid(fields, values, p) {
  return `<div class="grid">${fields.map((f) => field(f, values[f[0]], p)).join("")}</div>`;
}
const layoutFields = [
  ["layout", "Test layout"],
  ["tip", "Tip size (inches)"],
  ["nozzle", "Nozzle pressure (PSI)", "number"],
  ["targetGpm", "Layout GPM", "number"],
  ["position", "Pump changeover valve position"],
];
function metricHTML(i) {
  const r = results(data, i);
  return `<div class="metrics">${[
    ["Average GPM", "gpm"],
    ["Average pitot PSI", "pitot"],
    ["Engine RPM*", "engine"],
    ["Pump RPM*", "pump"],
  ]
    .map(([l, k]) => `<div class="metric">${l}<b>${fmt(r[k])}</b></div>`)
    .join("")}</div>`;
}
function errorHTML() {
  const a = issues(data);
  return a.length
    ? `<div class="errors" role="alert"><b>Review before completing (${a.length})</b><ul>${a.map((e) => `<li><a href="#" data-error="${e.path}">${esc(e.message)}</a></li>`).join("")}</ul><p>Incomplete tests can be retained as drafts and exported. Select “Incomplete” or “Not assessed” to record a test without a Pass/Fail assessment.</p></div>`
    : '<p class="notice">Required record fields are complete. The tester must assess the result; this app does not certify compliance.</p>';
}
function render() {
  $("steps").innerHTML = steps
    .map(
      (s, i) =>
        `<button data-step="${i}" class="${step === i ? "active" : ""}" ${step === i ? 'aria-current="step"' : ""}>${i + 1}. ${s}</button>`,
    )
    .join("");
  $("stepLabel").textContent =
    step === 7 ? "Saved records" : `Section ${step + 1} of 7 · ${steps[step]}`;
  $("progress").value = Math.min(step + 1, 7);
  $("progressLabel").textContent =
    step === 7
      ? `${history.length} saved`
      : required.filter((k) => String(data.values[k] ?? "").trim()).length +
        ` / ${required.length} required record fields`;
  let html = "";
  if (step === 0)
    html = `<h1>Apparatus information</h1><p class="muted">Start with the apparatus being tested. * Required to complete a record.</p>${grid(
      apparatus.filter((f) => !["pump", "pumpSerial"].includes(f[0])),
      data.values,
    )}`;
  if (step === 1)
    html = `<h1>Pump information & setup</h1><p class="notice">RPM calculations (*) retain the earlier app’s multiplication: actual counter × counter ratio, then × gear ratio. The engine/pump basis selector is retained as recorded information only. Confirm direction and basis against the missing workbook before relying on RPM results. Other unspecified units should be recorded in comments.</p>${grid(
      apparatus.filter((f) => ["pump", "pumpSerial"].includes(f[0])),
      data.values,
    )}<h2>Setup & additional pump checks</h2>${grid(setup, data.values)}`;
  if (step >= 2 && step <= 4) {
    let i = step - 2,
      t = data.tests[i],
      s = specs[i];
    html = `<h1>${s.pct} capacity test</h1><p class="muted">${s.psi} PSI section from the existing app · ${s.count} readings. Confirm applicable test requirements with the original sheet.</p>${grid(layoutFields, t, `tests.${i}.`)}${t.rows.map((r, j) => `<section class="testrow"><h2>Reading ${j + 1} / ${s.count}</h2>${grid(reading, r, `tests.${i}.rows.${j}.`)}<p class="muted" id="rpm-${j}">Engine counter RPM*: ${fmt(engineCounter(data, r))} · Pump counter RPM*: ${fmt(pumpCounter(data, r, i))}</p></section>`).join("")}<h2>Calculated averages</h2><div id="metrics">${metricHTML(i)}</div><p class="muted">Blank or invalid readings are excluded. Partial averages do not indicate a completed test.</p>`;
  }
  if (step === 5)
    html = `<h1>Additional tests & sign-off</h1><p class="muted">Vacuum, pressure control and tank-to-pump fields are in Pump & setup. Enter excess power readings and comments here. Signature is a typed name.</p>${grid(extra, data.values)}`;
  if (step === 6)
    html = `<h1>Final results</h1><p class="muted">No automatic acceptance thresholds are applied. Record the tester’s overall assessment and its basis.</p>${grid(resultFields, data.values)}<div id="errors">${showErrors ? errorHTML() : ""}</div><div class="scroll"><table><thead><tr><th>Calculated result</th>${specs.map((s) => `<th>${s.pct}</th>`).join("")}</tr></thead><tbody>${[...summary, ["Changeover valve", "position"], ["Tip size (inches)", "tip"]].map(([l, k]) => `<tr><th>${esc(l)}</th>${data.tests.map((t, i) => `<td>${esc(k === "position" || k === "tip" ? t[k] : fmt(results(data, i)[k]))}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="buttons"><button id="saveTest">Save completed test</button><button id="pdf">Download PDF</button><button id="share">Share Report</button><button id="print">Print / Save as PDF</button></div><p class="muted">PDFs include all readings, averages, comments, and typed signature. Workbook validation remains pending. Export JSON backups for restorable records.</p>`;
  if (step === 7)
    html = `<h1>Saved test history</h1><label class="field">Search department, apparatus number, or test date<input id="search" type="search" value="${esc(search)}" placeholder="Search records…"></label><div id="historyRows"></div><div class="buttons"><button id="export">Export backup (history + draft)</button><button id="import">Import backup</button><input id="importFile" type="file" accept="application/json,.json" hidden>${readFailed ? '<button id="recovery">Export raw recovery data</button>' : ""}</div><p class="muted">Import merges records. Conflicting records are kept as separate copies. Imported drafts are offered for recovery without replacing the current draft automatically.</p>`;
  $("page").innerHTML = `<section class="panel">${html}</section>`;
  $("nav").innerHTML =
    `<button id="prev" ${step === 0 ? "disabled" : ""}>← Back</button><button id="next" ${step >= 6 ? "disabled" : ""}>Next →</button><button id="historyBtn">History</button><button id="backupBtn">Export backup</button>`;
  $("prev").onclick = () => go(step - 1);
  $("next").onclick = () => go(step + 1);
  $("historyBtn").onclick = () => go(7);
  $("backupBtn").onclick = exportBackup;
  document
    .querySelectorAll("[data-step]")
    .forEach((b) => (b.onclick = () => go(+b.dataset.step)));
  document.querySelectorAll("[data-path]").forEach((el) =>
    el.addEventListener("input", () => {
      const parts = el.dataset.path.split(".");
      let obj = data;
      for (const k of parts.slice(0, -1)) obj = obj[k];
      obj[parts.at(-1)] = el.value;
      persist();
      if (el.dataset.number)
        el.setAttribute(
          "aria-invalid",
          issues(data).some((e) => e.path === el.dataset.path),
        );
      if (step >= 2 && step <= 4) {
        let i = step - 2;
        $("metrics").innerHTML = metricHTML(i);
        data.tests[i].rows.forEach(
          (r, j) =>
            ($("rpm-" + j).textContent =
              `Engine counter RPM*: ${fmt(engineCounter(data, r))} · Pump counter RPM*: ${fmt(pumpCounter(data, r, i))}`),
        );
      }
      if (step === 6 && showErrors) {
        $("errors").innerHTML = errorHTML();
        bindErrors();
      }
    }),
  );
  if (step === 6) {
    $("saveTest").onclick = saveTest;
    $("pdf").onclick = () => pdfAction(data);
    $("share").onclick = () => pdfAction(data, true);
    $("print").onclick = () => printTest(data);
    bindErrors();
  }
  if (step === 7) {
    renderHistory();
    $("search").oninput = (e) => {
      search = e.target.value;
      renderHistory();
    };
    $("export").onclick = exportBackup;
    $("import").onclick = () => $("importFile").click();
    $("importFile").onchange = importBackup;
    if ($("recovery"))
      $("recovery").onclick = () =>
        download(
          new Blob(
            [
              JSON.stringify({
                history: localStorage.getItem(STORE),
                draft: localStorage.getItem(DRAFT),
              }),
            ],
            { type: "application/json" },
          ),
          "pump-raw-recovery.json",
        );
  }
}
function go(i) {
  step = Math.max(0, Math.min(7, i));
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function bindErrors() {
  document.querySelectorAll("[data-error]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        const p = a.dataset.error;
        step = p.startsWith("tests.")
          ? +p.split(".")[1] + 2
          : apparatus.some((f) => f[0] === p.split(".")[1])
            ? ["pump", "pumpSerial"].includes(p.split(".")[1])
              ? 1
              : 0
            : setup.some((f) => f[0] === p.split(".")[1])
              ? 1
              : extra.some((f) => f[0] === p.split(".")[1])
                ? 5
                : 6;
        render();
        const el = document.querySelector(`[data-path="${p}"]`);
        el?.focus();
        el?.scrollIntoView({ block: "center" });
      }),
  );
}
function renderHistory() {
  const list = history.filter((d) =>
    [d.values.department, d.values.apparatus, d.values.date].some((v) =>
      String(v ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  $("historyRows").innerHTML = list.length
    ? `<div class="scroll"><table><thead><tr><th>Date</th><th>Apparatus / department</th><th>Result</th><th>Actions</th></tr></thead><tbody>${list.map((d, i) => `<tr><td>${esc(d.values.date)}</td><td>${esc(d.values.apparatus)}<br>${esc(d.values.department)}</td><td>${esc(d.values.overallResult || "Legacy / not assessed")}</td><td><button data-open="${i}">Open</button><button data-report="${i}">PDF</button><button data-delete="${i}" class="danger">Delete</button></td></tr>`).join("")}</tbody></table></div>`
    : '<p class="empty">No matching saved tests.</p>';
  document.querySelectorAll("[data-open]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          !confirm(
            "Open this saved test? Your active draft will be replaced. Export a backup first to keep it.",
          )
        )
          return;
        data = structuredClone(list[+b.dataset.open]);
        persist();
        showErrors = false;
        go(0);
      }),
  );
  document
    .querySelectorAll("[data-report]")
    .forEach((b) => (b.onclick = () => pdfAction(list[+b.dataset.report])));
  document.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = () => {
        if (
          !confirm(
            "Permanently delete this history record? Export a backup first.",
          )
        )
          return;
        const next = history.filter((d) => d.id !== list[+b.dataset.delete].id);
        if (write(STORE, next)) {
          history = next;
          render();
        }
      }),
  );
}
function saveTest() {
  showErrors = true;
  if (issues(data).length) {
    render();
    $("errors").scrollIntoView({ block: "center" });
    return;
  }
  const copy = structuredClone(data);
  copy.completed = new Date().toISOString();
  const next = [copy, ...history.filter((d) => d.id !== copy.id)];
  if (write(STORE, next)) {
    history = next;
    data = copy;
    persist();
    alert(
      "Completed test saved in history on this device. Export a backup for safekeeping.",
    );
  }
}
function exportBackup() {
  download(
    new Blob(
      [
        JSON.stringify(
          {
            format: "pump-service-backup",
            version: 2,
            exported: new Date().toISOString(),
            tests: history,
            draft: data,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    `pump-service-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
async function importBackup(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    if (f.size > 20 * 1024 * 1024) throw Error("Backup exceeds 20 MB.");
    const incoming = parseBackup(await f.text());
    if (
      !confirm(
        `Merge ${incoming.tests.length} saved test(s)? Existing records will be kept.`,
      )
    )
      return;
    const merged = mergeHistory(history, incoming.tests);
    if (!write(STORE, merged.tests)) return;
    history = merged.tests;
    if (
      incoming.draft &&
      confirm(
        "Also recover the backup’s draft? This replaces the active draft. Cancel keeps your current draft.",
      )
    ) {
      data = structuredClone(incoming.draft);
      persist();
    }
    render();
    alert(
      `Imported ${incoming.tests.length} tests. ${merged.conflicts} conflicting record(s) kept as copies.`,
    );
  } catch (err) {
    alert("Unable to import: " + err.message);
  } finally {
    e.target.value = "";
  }
}
function printTest(d) {
  $("printReport").innerHTML = reportHTML(d);
  window.print();
}
async function pdfAction(d, share = false) {
  try {
    const blob = createPDF(d),
      name = filename(d);
    if (share && navigator.share) {
      const file = new File([blob], name, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Pump Service Test Report",
          });
          return;
        } catch (e) {
          if (e.name === "AbortError") return;
        }
      }
    }
    download(blob, name);
    if (share)
      alert(
        "PDF downloaded. File sharing is unavailable here; share it from your device’s Downloads or Files app.",
      );
  } catch (e) {
    alert(e.message);
  }
}
$("newTest").onclick = () => {
  if (
    !confirm(
      "Start a blank new test? This replaces the active draft, including any information not saved to history. Export a backup first if needed. Completed history will stay.",
    )
  )
    return;
  const next = fresh();
  if (!write(DRAFT, next)) return;
  data = next;
  showErrors = false;
  persist();
  go(0);
};
window.addEventListener("beforeunload", (e) => {
  if (storageBlocked || externalConflict) {
    e.preventDefault();
    e.returnValue = "";
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === STORE || e.key === DRAFT || e.key === null) {
    externalConflict = true;
    storageError(
      "Another app tab changed local records. Export this tab’s backup, close other tabs, and reload before continuing. Saving is paused to prevent overwriting records.",
    );
  }
});
let offlineReady = false;
function network() {
  $("network").textContent =
    (navigator.onLine ? "Online" : "Offline") +
    (offlineReady ? " · Offline ready" : " · Offline setup pending");
}
window.addEventListener("online", network);
window.addEventListener("offline", network);
network();
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("./sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      offlineReady = true;
      network();
    })
    .catch(() => {
      $("network").textContent = "Offline setup failed — reconnect and reload";
    });
let installPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  $("install").hidden = false;
});
$("install").onclick = async () => {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
    $("install").hidden = true;
  }
};
if (!readFailed) persist();
render();
