#!/bin/bash
# Healthy = the noVNC web endpoint answers AND the GUI process is alive.
# (In `cli` mode the container is one-shot and healthchecks do not apply.)
set -e
curl -fsS -o /dev/null http://127.0.0.1:6080/
pgrep -f "bin/CrealityPrint" >/dev/null
