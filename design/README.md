# AD5X Design workspace

This directory contains the actual editable source for the **Design** workspace shipped with the AD5X community build.

The goal is deliberately different from traditional desktop CAD: make common 3D-printing jobs quickly inside the slicer, keep the geometry editable, then hand the result directly to **Prepare** for slicing.

## What it is for

The current workspace supports practical workflows such as:

- organizers, trays and removable bins;
- boxes, lids, shells and dividers;
- electronics enclosures;
- connector and panel cut-outs;
- PCB and drilling jigs;
- pogo-pin guides and wire combs;
- mounting holes and bolt patterns;
- component wall mounting;
- adjustable clamping/fixture work;
- text, labels, placement, mirroring and patterns.

The intended workflow is:

**Design → Prepare → Slice/Preview → Print**

## Current accepted source

This public source was copied from the accepted 25 October 2026 Design source used for the deployed frontend.

The original 25 October development checkpoint passed:

- 15 / 15 focused component-library tests;
- TypeScript build;
- Vite/PWA build;
- isolated native 6 mm cutter test;
- installed MAIN GUI acceptance of the user-sized component controls.

For this public-source packaging pass on 26 October 2026, the copied `design/` tree was made self-contained for its test fixtures and then independently verified:

- **87 / 87 test files passed**;
- **635 / 635 tests passed**;
- **TypeScript/Vite/PWA production build passed**.

The test runner still emits the known Manifold/Three fallback warnings in its Node/Vitest environment; the suite nevertheless passed. An earlier full Design checkpoint passed 621 / 621 tests across 84 suites.

## Source layout

- `src/components/` — React user interface and task-oriented editing tools.
- `src/lib/` — CAD/CSG operations, enclosure/jig tools, export and Prepare handoff logic.
- `src/extensions/` — versioned offline component and Workshop extension definitions.
- `src/state/` — scene/project state and undo/redo history.
- `src/types/` — editable scene schema.
- `public/` — offline plate artwork, component images and connector thumbnails.
- `test/` — regression/fixture tests.
- `vendor/manifold/` — Manifold v3.5.1 WebAssembly build compiled without dynamic execution for the application's CSP. The corresponding `manifold-3d` package is recorded as Apache-2.0 in `package-lock.json`.

## Build

Requires Node.js/npm.

```bash
npm ci
npm test
npm run build
```

The build output is written to `dist/` and is intentionally not committed.

## Component Library

The current component-library workflow contains eight accepted entries.

Two use documented nominal openings:

- C14 switched inlet — 42 × 27 mm rectangular panel opening.
- ITW 59-111 — D-flat opening, nominal diameter 13.625 mm and flat-to-opposite 12.925 mm.

Six additional component entries use user-entered circle/rectangle dimensions rather than guessed manufacturer mounting geometry. The user chooses the enclosure wall, X/Y position and actual cut size; the tool performs real editable Boolean subtraction with edge-rim validation.

## Native integration

The installed RC1 uses a localhost-only handoff service to transfer validated binary STL data from Design to the native Creality Print **Prepare** workspace. STEP export uses a separate localhost FreeCAD/OpenCascade bridge when available.

Those launcher/service files currently contain machine-specific production paths and are **not copied into this public source folder yet**. They are being kept out rather than publishing personal paths or an untested rewritten launcher.

The Design frontend/CAD source in this directory is the accepted source; this note is only about packaging the local Windows bridge/runtime for a reusable public setup.

## Scope / limitations

This is a practical, task-oriented 3D-printing design workspace. It is not presented as a replacement for full mechanical CAD such as FreeCAD, Fusion or SolidWorks.

Do not infer physical fit or load capability from a successful Boolean/export/slice test. Where exact manufacturer cut-out geometry was not documented, the software intentionally uses user-entered dimensions instead of invented values.