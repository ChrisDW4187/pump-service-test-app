# Validation record

## Source review

Reviewed every original project file at commit `8ae63342666ab450b2a348af0fabcdc1b90c4def`: `index.html` and `README.txt`. There were no tests, manifest, service worker, icons, or workbook. The original Excel file is missing. **Required upload: the original pump service test `.xlsx` or `.xls` workbook, including all sheets, formulas, measurement labels and print settings.** Original workbook filename is unknown. No workbook was overwritten.

## Retained content

All original apparatus, setup/control, capacity layout, reading, excess-power, comments, title, and typed-signature fields remain. The 100%, 70%, and 50% sections retain five, three, and three readings. Pump identity fields are now grouped with pump/setup. Fields originally lacking units keep their original labels; record the units in comments until the workbook confirms them. New tests have blank values, eliminating apparatus-specific sample defaults.

## Arithmetic under test (not workbook-validated)

| Calculation        | Retained arithmetic                                           | Missing / invalid behavior                             |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------ |
| Engine counter RPM | Actual counter reading × counter ratio                        | Blank/invalid factor or non-positive ratio → no result |
| Pump counter RPM   | Engine counter RPM × section gear ratio                       | Blank/invalid factor or non-positive ratio → no result |
| Averages           | Sum of finite entered values ÷ count of finite entered values | Blank/invalid values excluded; no values → no result   |
| Display rounding   | Round to two decimal places                                   | Stored input strings remain unchanged                  |

Zero readings remain valid numerical readings. Negative readings are retained, including signed suction pressures; no unverified physical acceptance limits are imposed. Non-finite or malformed numeric values are flagged, retained in the form, and block completion. Derived values use the inputs without rounding each intermediate result.

**Unresolved:** The original app's engine/pump `counterMode` selection did not affect its RPM arithmetic. We preserve both that selector as recorded information and the existing multiplication. We cannot determine whether pump-based readings should use multiplication/division or another transformation without the source workbook. All RPM results are labeled unverified. Do not rely on them for operational decisions until this is resolved.

GPM/pitot are recorded values; no nozzle coefficient, inferred flow, pressure subtraction, or automated standard/threshold was invented. Fixed capacity/PSI section names come from the original code and must also be checked against the workbook.

## Record completeness, not a testing standard

To save a completed history record, department, date, apparatus ID, pump make/model, tester, typed signature, and overall assessment must be present. For a tester-entered Pass or Fail, each retained capacity reading must also contain time, GPM, and test-gauge pressure. These are minimum app record checks, not exhaustive testing criteria. Incomplete and Not assessed permit documenting an interrupted test with identification and sign-off. All entered numeric fields must be syntactically valid and entered ratios must be positive. Invalid values are never cleared automatically.

## Automated verification

`npm test` checks blank independent records; valid zero/signed readings; blank/invalid handling; legacy RPM multiplication; averages; required and invalid fields without data mutation; date validation; report inclusion of every schema field; old/new backup validation; conflict-preserving imports.

`npm run test:e2e` uses Chromium to check mobile autosave/reload/navigation, new-test history preservation, reopen/search, validation, numerical typing without focus loss, actual PDF download and extracted text/letter page size, native sharing through a mocked file-share API, download fallback, offline form/PDF availability, backup round-trip and rejection, storage failures, and touch sizes/no page overflow at phone, tablet and desktop widths. Additional scenarios cover all-field round trips, corrupt records, multiple tabs, long report comments and the GitHub Pages subdirectory path.

Dependency audit must report no known vulnerabilities. Tests validate the implementation arithmetic, **not Excel equivalence**. Browser emulation does not establish physical-device compatibility or pump-test compliance.

## Workbook acceptance checklist (pending upload)

1. Preserve the uploaded file unchanged and record its hash/version.
2. Inventory all worksheets, visible/hidden fields, units, formulas, named ranges and print areas.
3. Map every workbook input to a form field; add any missing fields without discarding existing data.
4. Resolve counter basis/direction, all average ranges, blank/zero handling, rounding, and any other calculated result with explicit cell references.
5. Build workbook-derived numerical test cases, including blanks and boundary cases.
6. Match PDF layout to the original print areas, then compare filled workbook and PDF with the same data.
7. Have the responsible department reviewer approve standards, required test readings, and any future acceptance logic before operational reliance.
