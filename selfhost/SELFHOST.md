# Self-hosted Docker version

Run the CrealityPrint AD5X community build on your own server (Unraid,
NAS, home-lab box) and drive the full slicer GUI from a browser — no
Windows PC required. This track is new and experimental; it is based on
the RC1 tag `v7.3.0-ad5x-rc1`.

## Quick start

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

Then open `http://<server>:6080/vnc.html`.

Or plain Docker:

```bash
docker run -d --name crealityprint-ad5x \
  -p 6080:6080 \
  -e VNC_PASSWORD='choose-a-password' \
  -e PUID=1000 -e PGID=1000 \
  -v crealityprint-config:/config \
  -v crealityprint-data:/data \
  --shm-size=1g \
  ghcr.io/catduckgnaf/crealityprint-ad5x:latest
```

### Configuration

| Setting | Default | Purpose |
| --- | --- | --- |
| `VNC_PASSWORD` | *(unset)* | Password for the desktop. **Set this** — without it the GUI is unauthenticated and must only be exposed on a trusted LAN or behind an authenticated reverse proxy. |
| `PUID` / `PGID` | `1000` / `1000` | User/group the app runs as; files in `/config` and `/data` get this ownership (Unraid convention). |
| `VNC_GEOMETRY` | `1920x1080` | Virtual desktop size. |
| `TZ` | `UTC` | Container timezone. |

### Volumes

| Mount | Contents |
| --- | --- |
| `/config` | App configuration, profiles and user presets (`HOME` lives here, so CrealityPrint's per-user data persists). |
| `/data` | Working directory: open models/projects from here, save G-code here. Bind-mount a host folder if you want direct access. |

### Printer networking (AD5X / Fluidd)

With Docker's default bridge networking the slicer can reach the printer
and Fluidd **by IP address**. mDNS-based printer *discovery* does not
cross a bridge network; if you depend on discovery, use host networking
(`network_mode: host` in compose — the GUI is then served on the host's
port 6080). The upstream `DockerRun.sh` used host networking for the
same reason.

### Headless CLI slicing

The same image runs the slicer binary directly, with no X server or VNC:

```bash
docker run --rm -v "$PWD/models:/data" \
  ghcr.io/catduckgnaf/crealityprint-ad5x cli /data/model.stl [binary args...]
```

Any first argument that isn't `gui`/`cli` is passed through to the
binary as well. Which slicing/export flags a given build supports is a
property of the CrealityPrint binary (Orca/Bambu lineage CLI) — check
with `cli --help` against the built image.

## How the image works

* `Dockerfile.selfhost` is a multi-stage build:
  1. **build** — Ubuntu 22.04, installs the build dependencies itself
     (see below), then runs the upstream `BuildLinux.sh -r -d` (deps)
     and `-r -s` (app + `build/package` tree). No AppImage is made.
  2. **nodebin** — supplies a Linux Node.js 22 binary for the Design
     bridge.
  3. **runtime** — Ubuntu 22.04 with the GUI stack and the packaged app
     in `/opt/crealityprint`.
* Browser GUI: **Xvfb + x11vnc + noVNC/websockify**, orchestrated by
  supervisord. This stack was chosen over KasmVNC because every part is
  a stock Ubuntu package — nothing is downloaded from a third-party
  vendor at build or run time, the image stays auditable, and it is a
  well-understood pattern for self-hosted desktop apps. Raw VNC is on
  port 5900 inside the container; only 6080 needs publishing.
* A Docker `HEALTHCHECK` polls the noVNC endpoint and the GUI process.

## Audit findings (why things are the way they are)

This packaging is based on a source audit of the RC1 tag; the important
results, including the blockers, are recorded here so nobody has to
rediscover them.

### Tag vs. master

The tag `v7.3.0-ad5x-rc1` (`29d9867e`) is an ancestor of `master`
(`820d4226`); master is 4 commits ahead — installer-doc changes, a
Design demo commit, and the commit that *publishes the Design workspace
source* (`design/`). This branch was created from the tag as the
released baseline, and `master` was then merged into it (the tag-based
branch conflicted with master's rewritten README, which also blocked
the PR's CI from starting). The branch therefore now contains the
`design/` source as well; the packaging itself is unchanged by the
merge.

### The existing Dockerfile is not a self-host image

The repo-root `Dockerfile`/`DockerBuild.sh`/`DockerRun.sh` are the
inherited OrcaSlicer **developer** container: it builds an AppImage and
runs it against the host's X11 session with host networking, a
bind-mounted home directory and `--privileged`. Defects/quirks found:

* stray `\ ` (backslash-space) line endings in the package list (e.g.
  after `libglew-dev`), which corrupt the continuation;
* duplicated packages (`libglu1-mesa-dev`, `libgtk-3-dev` twice);
* `libgstreamerd-3-dev` appears in both the Dockerfile and
  `linux.d/debian`. It is a *real* package — but it is the GStreamer
  **D-language** bindings (gtk-d source package), not something this C++
  build needs. It installs harmlessly; `Dockerfile.selfhost` simply
  omits it and installs the C GStreamer dev packages.
* `BuildLinux.sh -u` installs `linux.d/<distro>` via `sudo apt`, and the
  script gates on ≥10 GB free RAM unless `-r` is passed.

`BuildLinux.sh` itself is otherwise distro-aware (`linux.d/debian`,
`debian2`, `fedora`, `arch`, …) and reusable: deps via CMake/Ninja into
`deps/build`, app with `-DSLIC3R_STATIC=1`, and the package layout comes
from `src/platform/unix/BuildLinuxImage.sh.in`
(`package/bin/CrealityPrint`, `package/resources/`, launcher script that
sets `LD_LIBRARY_PATH`). The `flatpak/` manifest (GNOME runtime,
clang/lld) is a useful cross-check of the dependency set but is a
desktop distribution format, not a server image, so it is not reused
directly.

### Closed-source libraries — the arm64 blocker

`THIRD_PARTY.md` is accurate that Linux variants exist, but the arches
differ per library:

| Library | Linux binaries shipped | Consequence |
| --- | --- | --- |
| `deps/CR_TPMS` (`cr_tpms`) | x86_64, aarch64, arm64, loongarch64 | fine everywhere |
| `deps/CR_CLOSED/CR_FILLTENSOR` (`cr_FillTensor`) | **x86_64 only** | its CMake `FATAL_ERROR`s on any other Linux arch |
| `deps/CR_KM_RECIPE` (`cr_km_recipe`) | **x86_64 only** | same `FATAL_ERROR` behaviour |

**Therefore the self-host image is `linux/amd64` only** until upstream
ships aarch64 builds of FillTensor and KM Recipe (or makes them
optional). This is a hard blocker for arm64 servers, not a packaging
choice.

### AD5X / Klipper / offline code — portable

No hard Windows blocker was found in the fork's own changes:

* AD5X profiles/presets are JSON under `resources/profiles/Flashforge/`.
* `src/slic3r/Utils/Flashforge.cpp` (printer comms) is portable
  Boost.Asio/TCP + wxWidgets — no `WIN32` guards, no Windows APIs.
* The native AD5X status panel explicitly avoids WebView2.
* The few `#ifdef _WIN32` sites in `print_manage` (e.g. `cxmdns.cpp`,
  `AppUtils.cpp`, `PrinterMgr.cpp`) are the usual platform branches with
  POSIX counterparts, inherited from upstream.
* Upstream already builds this codebase on Linux (the commented-out
  `ubuntu-22.04`/`ubuntu-24.04` legs in
  `.github/workflows/build_all.yml`, marked "Deprecate appimage"), and
  `.github/workflows/build_all.yml` currently builds **Windows only**.

### Design workspace — the one real gap

Design is **not compiled into the app and not guarded by Windows
ifdefs** — the C++ side (`src/slic3r/GUI/MainFrame.cpp`,
`ad5x_design_*`) is portable. It expects an *external* runtime folder
next to the executable:

```
External_Runtime_Dependency_AD5X_Design_Service_20261025/
  node.exe            <- bundled Node
  serve_handoff.cjs   <- loopback bridge, port 18195
  www/index.html      <- built Design web app
  Handoff_Spool/      <- staged STL files for "Send to Prepare"
```

The app launches `"<node>" "<root>/serve_handoff.cjs" "<root>/www"
18195 "<root>/Handoff_Spool"`, loads `http://127.0.0.1:18195/` in a
wxWebView (WebKitGTK on Linux), and imports staged STLs when the page
posts an `AD5X_PREPARE:<32-hex>.stl` bridge message.

Problems for Linux, in order:

1. **Node lookup is hardcoded to `node.exe`** — all three candidate
   paths and the PATH fallback use the Windows filename. On Linux the
   lookup always "succeeds" (fallback) but launches a non-existent
   `node.exe`. *Workaround used by this image, no source change needed:*
   the image installs a genuine Linux Node binary under the literal
   name `node.exe` in the service folder. A proper upstream fix is a
   platform-conditional filename.
2. **`serve_handoff.cjs` is not in the public source** — not at the RC1
   tag and not in the Design source published afterwards. This image
   ships `selfhost/design-bridge/serve_handoff.cjs`, a clean-room,
   zero-dependency replacement implementing the contract recovered from
   `MainFrame.cpp` and `design/src/lib/prepareHandoff.ts`:
   `GET /ad5x-handoff/status`, `POST /ad5x-handoff/stl` (raw STL,
   `X-AD5X-Prepare: 1`, ≤ 80 MiB → spool ticket), static `www/`
   serving. The verified clamp-mesh endpoint
   (`POST /ad5x-handoff/cad-stl`) is answered `501`: it needs a CAD
   backend this bridge does not have, and the Design UI is written to
   report that service as unavailable rather than degrade silently.
   The replacement is unit-smoke-tested (status contract, STL ticket +
   spool write, static serving).
3. **`www/` assets are not built yet.** The Design source
   (`design/`, React/TypeScript/Vite) was published on master *after*
   the RC1 tag; it is in this branch's tree (via the master merge), but
   the image build does not yet have a Design stage
   (`npm ci && npm run build` → `dist/`). Until it does, the image
   ships a placeholder page in `www/`; you can bind-mount a locally
   built `dist/` over the `www/` folder to use Design today.

So on Linux today: **Prepare / slicing / device workflows are the
goal of this image; Design is scaffolded and bridged, but its web
assets are a follow-up**, not a silent no-op.

## CI

`.github/workflows/selfhost-docker.yml`:

* PRs touching the self-host packaging: build + smoke test (container
  starts, port 6080 answers, Docker healthcheck turns healthy, binary
  present/executable), nothing pushed.
* Pushes to `master` / `v*` tags (or manual dispatch with *push*
  enabled): publishes `ghcr.io/catduckgnaf/crealityprint-ad5x`.

Expect the first builds to take hours: the deps stage compiles
wxWidgets, Boost and the rest of the Orca-lineage dependency tree from
source. BuildKit layer + GHA caching makes iterations after the first
success much cheaper.

## Known limitations / follow-ups

* `linux/amd64` only (closed libs, above).
* Design web assets not bundled yet (above); the `design/` source is
  in the tree, so adding the Design build stage is the next step.
* The GUI is a streamed desktop (noVNC), not a native web app —
  WebKitGTK pages inside the slicer ( Fluidd view etc.) render inside
  that desktop.
* First-run CI is expected to shake out further Linux-build issues in
  the fork's own code (RC1 was only ever built for Windows); fixes land
  as follow-up commits on the PR.
