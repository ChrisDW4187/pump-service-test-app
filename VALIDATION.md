# Workbook validation record

## Source identity and scope

Source: **New Service Test Sheet June2026 copy.xlsx**, supplied by the user. One worksheet: **November 2004**. SHA-256: `0405f7dfd38dee1b513025c5f6c04512b170c31b6c016faa12a2352178c3eeea`.

The original was read only. Synthetic copies were created in a separate work directory for testing; neither the original nor department sample data is published in this repository. The source’s 126 formulas, merged-cell references, and all input-to-form mappings are recorded in [tests/fixtures/workbook-reference.json](tests/fixtures/workbook-reference.json). App-only additions are excess-power notes, an overall tester-entered result, and result-basis comments. The counter-basis selection records the sheet’s ENGINE or PUMP wording; the sheet contains no conditional formula for this selection.

The supplied sheet confirms the original 5/3/3 reading counts, the 150/200/250 PSI sections, all retained input fields, and the original engine-to-pump multiplication. Workbook example department, layout, nozzle, GPM and tip values are not auto-filled into new apparatus tests.

## Formula mapping

| Calculation                      | Source cells                             | Implemented arithmetic                                                                                  |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Engine counter RPM               | C21:C25, C35:C37, C44:C46                | Actual counter (O of same row) × F16                                                                    |
| Pump counter RPM, first test     | B21:B25                                  | Engine counter (C of same row) × F6                                                                     |
| Pump counter RPM, second test    | B35:B37                                  | Engine counter × H6                                                                                     |
| Pump counter RPM, third test     | B44:B46                                  | Engine counter × J6                                                                                     |
| Totals, all twelve B:M columns   | B26:M26, B38:M38, B47:M47                | SUM of section readings                                                                                 |
| Averages, all twelve B:M columns | B27:M27, B39:M39, B48:M48                | AVERAGE of section readings                                                                             |
| Excess-power engine counter RPM  | O29                                      | J30 (actual counter) × F16                                                                              |
| Excess-power pump counter RPM    | J29                                      | O29 × F6 (first-test gear ratio)                                                                        |
| Final-results links              | K52:K61, M52:M61, O52:O61 (merged pairs) | Source pitot, GPM, valve position, gauge pressures, suction, tip size, engine counter/tach and pump RPM |

The app previously omitted totals, four average columns (voltage, transmission temperature, oil pressure, water temperature), and excess-power calculated speeds. Version 2.1 adds them. All twelve numeric reading columns now have totals and averages. No nozzle coefficient, inferred GPM, pressure-subtraction formula, or automatic Pass/Fail criterion exists in the source, and none has been added.

## Blank, invalid and display behavior

**Workbook-version records:** Excel multiplication treats a blank numeric factor as zero. Thus every blank counter reading produces calculated engine/pump zero, and the RPM averages include all five or three calculated rows. Raw input averages ignore blanks. SUM of no raw inputs is zero. A raw AVERAGE with no numbers produces `#DIV/0!` in Excel; the app represents this as no result and displays **—**. Partial results are explicitly labeled and do not indicate test completion.

Invalid, non-finite, or out-of-range-to-represent numeric text is retained and blocks completion. It is not treated as zero. Dependent RPM results are suppressed for invalid inputs. Negative signed measurements (including suction) are retained; the app does not impose unverified physical acceptance limits. Ratios, when entered, must be positive as a data-entry rule; numerical zero-ratio reference cases still verify the formula arithmetic independently of that rule.

The app keeps full intermediate precision, displaying values to two decimal places. The worksheet uses mixed General, 0.0, and 0.00 formats; this is a presentation difference only. Raw input strings are retained in reports. Empty linked tip/position fields remain visibly blank/— in reports instead of Excel’s numeric zero for an empty reference; no unentered setting is inferred.

**Legacy records:** Existing records without a calculation-version marker retain the previous app’s arithmetic, including exclusion of blank counter factors from RPM averages. Their report identifies that behavior. They are not silently reinterpreted. **Copy with workbook calculations** creates a new ID with the same inputs and workbook behavior; it does not overwrite the saved original. Unknown future calculation versions are rejected rather than interpreted using the wrong rules.

## Units and report layout

The source explicitly labels PSI, RPM, GPM, suction-hose inches/feet, lift feet, suction seconds, and barometric/vacuum inches Hg. Tip examples include an inch mark. Temperature, elevation, displacement, and torque units are unspecified in the source and remain unspecified; record them in comments.

The source has portrait orientation, no fixed print area, no selected paper size, no fit-to-page setting, and no manual page breaks. The app uses standard letter pages. The report follows apparatus/setup, first test with its totals/averages, the 5-minute excess-power test, second/third tests with totals/averages, the ten-row final-results summary, comments and signature/title. Reading tables retain the workbook A:M/O column order. Extra app-only notes and overall assessment are included. Pagination/geometry are adapted for readability rather than a pixel-identical Excel printout. The sheet’s “All Test Results are Accurate & Correct” statement is included as a tester attestation, not an app certification.

## Independent numerical checks

[scripts/validate-workbook.py](scripts/validate-workbook.py) writes synthetic values into separate copies of the actual source workbook and invokes LibreOffice to recalculate the original formulas. [tests/fixtures/workbook-cases.json](tests/fixtures/workbook-cases.json) stores the resulting cell values. Node tests compare the app’s outputs for **every one of the 126 formula cells** across full, partial, blank, zero, blank-ratio and signed/fractional scenarios. This is a comparison with workbook formulas recalculated by LibreOffice, not a claim that Microsoft Excel was executed here. The source’s own cached formula results also document its zero/error behavior.

Tests additionally verify input coverage, unchanged legacy imports, conversion without mutation, report sequence/fields, storage recovery, backups, offline PDF generation and mobile layouts. Numerical checks use a small floating-point tolerance and preserve intermediate precision.

## Remaining acceptance checks

Formula and field mapping against this supplied workbook is complete. The workbook itself is not an independently verified testing standard. Department reviewers still need to confirm its applicability, resolve unspecified units, approve typed-signature procedures and tester-assessed outcomes, and run the physical-device checklist. No automated overall acceptance thresholds were inferred. Required app record fields and Pass/Fail reading-completeness rules remain administrative data checks, not exhaustive standard-compliance checks.
