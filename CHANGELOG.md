# Changelog

## Installer packaging update — 2026-10-26

- Refreshed the RC1 installer seed to use the standard FlashForge AD5X system defaults.
- Initial defaults: `Flashforge AD5X Generic PLA` and `0.20mm Standard @FF AD5X`.
- Verified 204 / 204 seed files and 10,269 / 10,269 application files against the release manifests.
- Current installer SHA-256: `DD2A81FBB2DD5D3A9C083A684882E4F521A8C777248FEF51D9F41F3876F467FB`.

## GitHub source/presentation update — 2026-10-26

- Published the accepted built-in AD5X Design workspace source under `design/`.
- Added portable regression fixtures so a clean public Design source tree can run its test suite without the historical development-directory layout.
- Verified the public Design copy: 87 / 87 test files and 635 / 635 tests passed; TypeScript/Vite/PWA production build passed.
- Added Design screenshots and a 42-second Design → Prepare → Preview demonstration.
- Reworked the project front page to explain the Design workflow before the lower-level AD5X/offline changes.
- Added Sculpo/Design and Manifold provenance/licence notes.
- The Windows RC1 installer packaging was subsequently refreshed with the generic AD5X defaults documented above.

## v7.3.0-ad5x-rc1

Initial public RC1 source release based on the preserved Creality Print 7.3 source baseline.

### AD5X integration

- Added FlashForge AD5X machine definition.
- Added AD5X 0.4 mm nozzle profile.
- Added AD5X build-plate artwork/resources.
- Added generic AD5X PLA, PLA+, PETG, ABS, ASA and TPU filament presets.
- Added 0.20 mm Standard AD5X process preset.
- Restored/preserved AD5X device UI resources and native status integration.
- Preserved the project's Send Print / Klipper / Fluidd workflow.

### Offline-focused changes

- Preserved the tested in-app update freeze.
- Removed or disabled active Creality cloud background paths used by the fork.
- Disabled cloud home by default.
- Hardened offline preset/update behavior.
- Reduced sensitive runtime logging.
- Hardened device exception handling and retry behavior.
- Removed dead update UI action and related warning-producing code.

### Release packaging

The RC1 installer was built separately from the source repository and verified by release manifests.

Installer SHA-256:

`DD2A81FBB2DD5D3A9C083A684882E4F521A8C777248FEF51D9F41F3876F467FB`

See [RELEASE_NOTES_RC1.md](RELEASE_NOTES_RC1.md).