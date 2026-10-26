# Design workspace attribution

The AD5X Design workspace began from the open-source **Sculpo** browser-based solid modeller and has been substantially modified for the built-in Creality Print workflow, practical 3D-printing tools, native Prepare handoff, organizers, enclosures, electronics jigs, component cut-outs, fixtures and other project-specific features.

Upstream Sculpo:

https://github.com/jwapps-app/sculpo

Sculpo is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. This repository also uses AGPL-3.0 for the fork as a whole; see the root `LICENSE.txt`.

The Design workspace also uses third-party npm packages recorded in `package-lock.json`. In particular, `vendor/manifold/` contains a Manifold v3.5.1 WebAssembly build compiled without dynamic execution for the application's Content Security Policy. The corresponding `manifold-3d` package is recorded as **Apache-2.0** in the lockfile.

This notice is for attribution and provenance. Individual third-party files remain subject to their applicable upstream licences.
