# CrealityPrint AD5X Offline Community

Unofficial community fork of Creality Print 7.3 focused on the FlashForge AD5X, four-channel IFS workflows, Klipper/Z-Mod compatibility, and offline-first operation.

This project is **not affiliated with or endorsed by Creality**. It is based on the open-source CrealityPrint project and remains under the GNU Affero General Public License v3.0.

## What this fork changes

Compared with the preserved Creality Print 7.3 source baseline, this RC1 source adds or preserves:

- FlashForge AD5X machine/profile resources.
- AD5X filament and process presets.
- AD5X device/status integration.
- Send-to-printer workflow support used by the AD5X integration.
- Klipper/Fluidd-oriented device workflow used by the project.
- Offline-focused hardening:
  - in-app update checks frozen/disabled;
  - cloud home disabled by default;
  - active Creality cloud background paths disabled;
  - preset/cloud sync paths disabled or guarded;
  - sensitive runtime logging reduced;
  - native status/device handling hardened.

The public RC1 changeset is intentionally limited to the source changes required for this fork. Internal project-control files used during development are not part of the public tree.

## RC1 release

Release tag:

`v7.3.0-ad5x-rc1`

Canonical Windows installer:

`CrealityPrint_7.3_AD5X_Offline_RC1_Setup.exe`

SHA-256:

`F11686C0904A7D07BF0F89EC5845913765B3D2903203FD3B5E873ACB61ACD05E`

### Verification status

The final RC1 package has been verified for:

- installer compilation;
- isolated installation;
- 10,269 / 10,269 installed application file hashes;
- 211 / 211 seeded configuration files;
- isolated uninstall;
- preservation of the packaged RC1 application payload.

Before final packaging, the application workflow had been accepted for startup, Design/Prepare, slicing/preview, Device/Fluidd and Send Print. Physical printing, four-channel IFS and Fluidd operation were user-verified during the project.

The final repackaging pass **did not run a new physical print or a complete new post-installer GUI acceptance cycle**. Those earlier functional results should not be interpreted as a fresh RC1 installer retest.

## Important signing note

The retained upstream `CrealityPrint.exe` has a valid signature.

The custom RC1 installer and modified `CrealityPrint_Slicer.dll` are currently **unsigned**. Windows application-control configurations such as Smart App Control may therefore require additional trust/signing work.

## Upstream binary dependencies

The upstream CrealityPrint source contains precompiled Creality components including:

- `deps/CR_CLOSED/CR_FILLTENSOR`
- `deps/CR_TPMS`

This fork preserves those upstream files unmodified. Their implementation source is not currently present in the upstream public CrealityPrint repository. See [THIRD_PARTY.md](THIRD_PARTY.md) for the exact disclosure.

## Building

See [BUILDING.md](BUILDING.md).

## Self-hosted Docker (experimental)

A browser-accessible, self-hosted Linux version (Xvfb + noVNC,
persistent config/data volumes, headless CLI mode) is packaged in
`Dockerfile.selfhost` with `docker-compose.selfhost.yml`. See
[selfhost/SELFHOST.md](selfhost/SELFHOST.md) for usage, the source audit behind
it, and its current limitations (linux/amd64 only; Design web assets
not yet bundled).

The original upstream README has been preserved as [UPSTREAM_README.md](UPSTREAM_README.md).

## Changes

See [CHANGELOG.md](CHANGELOG.md).

Detailed RC1 verification and limitations are in [RELEASE_NOTES_RC1.md](RELEASE_NOTES_RC1.md).

## Upstream

Original project:

https://github.com/CrealityOfficial/CrealityPrint

CrealityPrint is derived from OrcaSlicer, Bambu Studio, PrusaSlicer and Slic3r. Upstream attribution and licence notices are retained.

## License

GNU Affero General Public License v3.0.

See [LICENSE.txt](LICENSE.txt).

Trademarks and product names belong to their respective owners.
