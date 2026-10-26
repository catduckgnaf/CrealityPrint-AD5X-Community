# CrealityPrint AD5X on macOS

macOS support for this fork is **new, experimental, and unsigned**.
Release `v7.3.0-ad5x-rc1` shipped only a Windows installer; this page
documents the macOS build track that starts from that tag.

Nothing in this document has been verified on a real Mac yet. See
[What is unverified](#what-is-unverified) before relying on any of it.

## TL;DR

- CI builds one `.dmg` per architecture — `arm64` (Apple Silicon) and
  `x86_64` (Intel) — because the closed Creality libraries are per-arch
  only (no universal archive exists; see [Audit notes](#audit-notes)).
- Builds are produced by `.github/workflows/build_macos.yml`
  (manual dispatch) using the repo's own `build_release_macos.sh`.
- The app is **not signed and not notarized**. macOS Gatekeeper will
  block it on first launch; see
  [Installing an unsigned build](#installing-an-unsigned-build).

## Building in CI (recommended)

1. Go to **Actions → “Build macOS (AD5X fork)” → Run workflow**.
2. Choose the architecture (`all`, `arm64`, or `x86_64`).
   Leave *build-deps-only* off unless you only want to warm the
   dependency cache.
3. Runner mapping (native host per arch — this matters, see below):
   - `arm64` → `macos-15` (Apple Silicon)
   - `x86_64` → `macos-15-intel` (Intel). `macos-13` was retired by
     GitHub on 2025-12-04 and must not be used; GitHub plans to end
     macOS x86_64 runner support after the macOS 15 image retires
     (Fall 2027), so treat the Intel leg as time-boxed.
4. Download the `CrealityPrint-macOS-<arch>-unsigned` artifact from the
   finished run. It contains the `.dmg` and its SHA-256 file.
5. Verify before installing: `shasum -a 256 -c *.sha256`

The first run for each architecture builds the full dependency tree
(wxWidgets, Boost, OpenCV, …) and can take a long time; later runs
reuse the `actions/cache` entry keyed on `hashFiles('deps/**')` plus
the architecture, following the pattern of the repo's existing
`build_check_cache.yml`.

Pull requests never start a full macOS build implicitly (it takes
hours). PRs touching this track only run a lightweight validation job
that checks the workflow YAML, the build script syntax, and that the
closed libraries still ship a macOS archive for both architectures.

## Building locally on a Mac

Prerequisites: Xcode Command Line Tools, Homebrew, CMake ~3.28
(the pin the repo's other workflows use), and several hours of disk
and patience for the first deps build.

```sh
brew install ninja gettext ccache
export PATH="$(brew --prefix gettext)/bin:$PATH"   # run_gettext.sh needs msgfmt

# Dependencies (per architecture; repeat with -a x86_64 on an Intel Mac)
./build_release_macos.sh -d -x -a arm64

# Slicer / app
./build_release_macos.sh -s -x -a arm64
```

The app bundle lands in `build_check_arm64/src/CrealityPrint.app`
(`build_check_x86_64/…` for Intel). The upstream script's own DMG
packaging is commented out, so package it the same way CI does:

```sh
APP=build_check_arm64/src/CrealityPrint.app
STAGE="$(mktemp -d)"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "CrealityPrint (arm64)" -srcfolder "$STAGE" \
  -ov -format UDZO CrealityPrint_macOS_arm64_unsigned.dmg
shasum -a 256 CrealityPrint_macOS_arm64_unsigned.dmg
```

Notes:

- Default deployment target is macOS 11.3 (`-t` flag on
  `build_release_macos.sh`). The official App Store pipeline uses
  12.0; that variant needs signing material this fork does not have.
- `scripts/build_package_macos.sh` is the official Jenkins packaging
  script. It additionally requires `ccache` and a Breakpad `dump_syms`
  tool and is wired for Creality's internal Macs and keychains, so CI
  here deliberately uses `build_release_macos.sh` instead.
- Do **not** try a universal (`arm64;x86_64`) build: the closed
  `cr_FillTensor` CMake module refuses it (see below).

## Installing an unsigned build

Because the `.dmg`/`.app` is unsigned and not notarized, Gatekeeper
will say the app “cannot be opened because the developer cannot be
verified” (or that it is damaged, on some macOS versions). Options,
in order of preference:

1. Drag `CrealityPrint.app` to `/Applications`, then **right-click
   (Control-click) the app → Open**, and confirm **Open** in the
   dialog. You only need to do this once.
2. Or, after copying to `/Applications`, clear the quarantine flag:
   ```sh
   xattr -dr com.apple.quarantine /Applications/CrealityPrint.app
   ```
3. Or use **System Settings → Privacy & Security** and click
   **Open Anyway** next to the blocked-app message.

Only do this for builds whose SHA-256 you verified against the CI run
you dispatched yourself. There is no way to make this “just work” for
other users without an Apple Developer account: proper signing and
notarization are future work and require catduck's own Apple
Developer ID certificate and App Store Connect credentials — they
must never be committed to this repo.

## What is unverified

No part of the macOS build has been run on a real Mac yet. In
particular, all of the following are **unverified**:

- the app launching at all (GUI / wxWidgets / WebView on macOS);
- the **Design tab**: the Design workspace expects a runtime folder
  named `External_Runtime_Dependency_AD5X_Design_Service_20261025`
  next to the executable, containing `serve_handoff.cjs`, `www/`, and
  a Node executable. Only a Windows package of that runtime has ever
  shipped (with a Windows `node.exe`). This PR makes the launcher look
  for a POSIX `node` on non-Windows platforms, but no macOS Design
  runtime bundle exists yet, so the Design tab will log
  “AD5X Design runtime is incomplete” until one is assembled;
- slicing with an AD5X profile (the FlashForge/AD5X profiles are data
  files under `resources/profiles/` and are platform-neutral, but no
  macOS slice has been produced or compared);
- **Send Print** / Device (Fluidd/Klipper) flows;
- printing itself, obviously.

## Audit notes

Findings from auditing this repo at tag `v7.3.0-ad5x-rc1`
(2026-10-26); also recorded in the pull request that introduced this
track.

- **Tag vs master:** tag `v7.3.0-ad5x-rc1` is commit `29d9867`;
  `master` is 4 commits ahead (`820d422`), adding the `design/`
  source tree and installer-doc changes. This track branches off the
  **tag**, matching the shipped RC1.
- **Existing workflows are Windows-only.** `build_all.yml` matrices
  only `windows-latest` (the Linux legs are commented out), and
  `build_deps.yml` / `build_creality_print.yml` contain only Windows
  build steps. A macOS residue survives in `build_check_cache.yml`,
  which special-cases `macos-14` for the deps folder name.
- **Closed libraries cover both Mac arches, per-arch only.**
  `deps/CR_CLOSED/CR_FILLTENSOR/cr_FillTensor/lib/mac/{arm64,x86_64}/`
  and `deps/CR_TPMS/cr_tpms/lib/mac/{arm64,x86_64}/` each contain a
  `lib*.a`; the object files inside were inspected and are genuine
  Mach-O 64-bit objects of the matching architecture. There is **no
  universal archive**: `cr_FillTensor.cmake` raises `FATAL_ERROR`
  (“does not provide a universal macOS archive. Build arm64 and
  x86_64 dependencies separately”) if `CMAKE_OSX_ARCHITECTURES` has
  more than one entry. Upstream's `JenkinsPipeline.MacAppStore`
  follows the same rule — separate per-arch builds, merged only at
  signing time.
- **`cr_tpms.cmake` picks its archive by host processor**
  (`lib/mac/${CMAKE_SYSTEM_PROCESSOR}/…`) rather than by target
  architecture. Cross-compiling x86_64 on an Apple Silicon host
  would silently copy the arm64 archive into an x86_64 build. That
  is why CI uses a native Intel runner for the x86_64 leg.
- **Official Mac recipe mined from Jenkins.**
  `Jenkinsfile` has optional macOS x86_64/arm64 stages running
  `scripts/build_package_macos.sh`, which drives CMake with Ninja,
  deployment target 11.3 (12.0 for App Store) and
  `deps/build_<arch>/dep_<arch>` as the deps tree — the same layout
  `build_release_macos.sh` uses. `JenkinsPipeline.MacAppStore` builds
  per-arch with Ninja and a 12.0 target, then assembles a signed
  universal app with Creality's certificates; none of that signing
  infrastructure exists (or should exist) in this fork.
- **First CI runs (2026-10-26).** Run `40409036248` failed in
  seconds: repo shell scripts are mode `100644` in git, so the
  workflow now invokes the build script via `bash` and `chmod +x`s
  the helpers it calls internally. Run `40409296170` then got real
  compilation going but both arches stopped in the deps build at
  `dep_PNG`: libpng 1.6.35's `pngpriv.h:524` includes `<fp.h>` for
  `TARGET_OS_MAC`, and `fp.h` no longer exists in the macOS 15 SDK
  on current GitHub runners. This is the “one-time png repair” the
  App Store pipeline alludes to. Fix: `deps/PNG/PNG.patch` (the patch
  the deps build already applies on Apple) now also swaps that
  include to `<math.h>` — the same fix used by Qt and others, and
  what later libpng releases do. The extended patch was verified to
  apply cleanly against the pristine, SHA-256-pinned 1.6.35 archive
  with the exact `git apply` flags the deps build uses. Run
  `40410087298` then progressed past PNG on both arches and stopped
  on missing runner tools — `nasm` (dep_x264 configure, x86_64) and
  `autoreconf` (dep_MPFR configure) — which the workflow's brew
  install step now provides. Expect further deps of the same vintage
  to need similar repairs; each will surface as a named failing step
  in the workflow run.
- **Design / offline code is otherwise platform-neutral.** The AD5X
  offline changes (cloud/analytics/login disabled, Design tab,
  AD5X profiles) live in ordinary cross-platform GUI code paths. The
  one Windows-only assumption found is the Design Node lookup in
  `src/slic3r/GUI/MainFrame.cpp`, which hardcoded `node.exe`; fixed
  in this PR for non-Windows platforms (Windows behaviour unchanged).
- **CMake presets** `Clang_Mac` / `Clang_Mac_arm64` exist in
  `CMakePresets.json` for local development; CI uses
  `build_release_macos.sh` to match the official recipe instead.
