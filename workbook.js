// Cell references from the uploaded, unchanged workbook. See VALIDATION.md.
export const WORKBOOK_VERSION = "workbook-june2026-v1";
export const WORKBOOK_SOURCE = {
  file: "New Service Test Sheet June2026 copy.xlsx",
  sheet: "November 2004",
  sha256: "0405f7dfd38dee1b513025c5f6c04512b170c31b6c016faa12a2352178c3eeea",
};
export const sections = [
  { first: 21, last: 25, total: 26, average: 27, ratio: "F6", layout: 18 },
  { first: 35, last: 37, total: 38, average: 39, ratio: "H6", layout: 32 },
  { first: 44, last: 46, total: 47, average: 48, ratio: "J6", layout: 41 },
];
export const numericColumns = [
  ["B", "pump", "Counter pump (RPM)"],
  ["C", "engine", "Counter engine (RPM)"],
  ["D", "tach", "Apparatus tach (RPM)", "apparatusTach"],
  ["E", "apparatusPressure", "Pump pressure: apparatus gauge (PSI)"],
  ["F", "testPressure", "Pump pressure: test gauge (PSI)"],
  ["G", "suction", "Actual suction pressure (PSI)"],
  ["H", "pitot", "Pitot pressure (PSI)"],
  ["I", "gpm", "GPM"],
  ["J", "voltage", "Voltage"],
  ["K", "transTemp", "Transmission temperature"],
  ["L", "oilPressure", "Oil pressure (PSI)"],
  ["M", "waterTemp", "Water temperature"],
];
export const finalRows = [
  ["Average nozzle pressure (PITOT)", "pitot"],
  ["Gallons per minute", "gpm"],
  ["Pump changeover valve setting", "position"],
  ["Average pump pressure (apparatus gauge)", "apparatusPressure"],
  ["Average pump pressure (test gauge)", "testPressure"],
  ["Suction pressure", "suction"],
  ["Tip size", "tip"],
  ["Average RPM (engine from counter)", "engine"],
  ["Average RPM (engine from apparatus tach)", "tach"],
  ["Average RPM (pump)", "pump"],
];
