# RC1 Release Notes

## CrealityPrint 7.3 AD5X Offline RC1

Release tag:

`v7.3.0-ad5x-rc1`

Windows installer:

`CrealityPrint_7.3_AD5X_Offline_RC1_Setup.exe`

Size:

`315,528,883 bytes`

SHA-256:

`DD2A81FBB2DD5D3A9C083A684882E4F521A8C777248FEF51D9F41F3876F467FB`

## Packaged application verification

Final packaged application:

- 10,269 files covered by the application manifest;
- 10,267 files byte-identical to the known-good hardened pre-packaging build;
- 1 informational README correction;
- 1 additional bundled Design Node executable.

Key binaries:

`CrealityPrint.exe`

SHA-256:

`A746259E2164C7C49F7D71B57DEDFE14E9329211AE7C4BD2BF8ACEACC6B87570`

Signature status observed during release verification: **Valid**

`CrealityPrint_Slicer.dll`

SHA-256:

`EAA5FA02D35C0F3CDC0F6109896F87279FB0A2786DF66415B79FA8BA83D24F3D`

Signature status observed during release verification: **NotSigned**

## Configuration seed

- 204 / 204 seed files verified by SHA-256.
- AD5X 0.4 mm nozzle multi-material/Klipper machine definition included.
- Initial selections use the generic system presets `Flashforge AD5X Generic PLA` and `0.20mm Standard @FF AD5X`.
- Offline preset syncing is disabled.
- RC1 user-data location is isolated from the normal Creality Print roaming profile.

## Installer verification

The current package passed:

- Inno Setup compilation;
- 10,269 / 10,269 application manifest hashes;
- 204 / 204 seed manifest hashes;
- canonical Setup EXE / release-copy hash match;
- one-file ZIP entry hash match to the Setup EXE.

## Functional acceptance boundary

Before final release packaging, the application workflow had been accepted for:

- application startup;
- Design/Prepare;
- slicing and preview;
- Device/Fluidd;
- Send Print.

Physical printing, four-channel IFS and Fluidd were user-verified during the project.

The final packaging repair itself did **not** execute a new physical print or a complete new GUI workflow after installation. These items are therefore prior functional acceptance, not a fresh installer-level retest.

## Known limitations

- The custom RC1 setup executable is unsigned.
- The modified `CrealityPrint_Slicer.dll` is unsigned.
- Smart App Control / Code Integrity behavior for the final RC1 DLL has not been proven under an actively enforced SAC policy.
- Upstream precompiled `cr_FillTensor` and `cr_tpms` dependencies do not include their implementation source in the upstream public repository.

## Source checkpoint

Private development source checkpoint used to derive this public release:

`c658e37875e826af574379bc241d42b8ae2868a2`

The public branch intentionally omits internal project-control files that were not part of the application.