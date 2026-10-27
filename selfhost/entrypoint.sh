#!/bin/bash
# Entrypoint for the self-hosted CrealityPrint AD5X image.
#
# Modes:
#   gui            (default) Xvfb + x11vnc + noVNC + the GUI under
#                  supervisord. This is the self-hosted server mode.
#   cli <args...>  Headless passthrough: run the CrealityPrint binary
#                  directly with <args...> (no X server, no VNC).
#                  Example:
#                    docker run --rm -v $PWD/models:/data \
#                      ghcr.io/catduckgnaf/crealityprint-ad5x cli \
#                      /data/model.stl --export-gcode ...
#                  The binary is the Orca/Bambu-lineage CrealityPrint
#                  executable; which CLI flags a given build supports is
#                  a property of that binary (check `cli --help`).
#   <file/flags>   Any first argument that is not "gui"/"cli" is also
#                  treated as CLI arguments to the binary.
#   shell          A bash shell (debugging).
set -e

APP_BIN=/opt/crealityprint/bin/CrealityPrint
APP_LAUNCHER=/opt/crealityprint/CrealityPrint

run_cli() {
    # Run as the unprivileged app user when we are root, so files written
    # to /data keep the PUID/PGID ownership the operator configured.
    if [ "$(id -u)" = "0" ]; then
        exec gosu app "$APP_BIN" "$@"
    fi
    exec "$APP_BIN" "$@"
}

case "${1:-gui}" in
    cli)
        shift
        run_cli "$@"
        ;;
    shell)
        exec /bin/bash
        ;;
    gui)
        ;;
    *)
        # Anything else (a model path, --flags, ...) is a CLI invocation.
        run_cli "$@"
        ;;
esac

# --- GUI mode ---------------------------------------------------------------
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# Remap the app user to the requested ids (Unraid-style PUID/PGID).
if [ "$(id -u app)" != "$PUID" ]; then
    usermod -o -u "$PUID" app
fi
if [ "$(id -g app)" != "$PGID" ]; then
    groupmod -o -g "$PGID" app
fi

mkdir -p /config/.config /config/.local/share /data \
         /config/.vnc \
         "/opt/crealityprint/bin/External_Runtime_Dependency_AD5X_Design_Service_20261025/Handoff_Spool"
chown -R app:app /config /data
# The Design spool must be writable by the app; the rest of /opt is
# world-readable from the image build.
chown -R app:app "/opt/crealityprint/bin/External_Runtime_Dependency_AD5X_Design_Service_20261025/Handoff_Spool" || true

# VNC password: if VNC_PASSWORD is set, x11vnc requires it; otherwise the
# VNC server runs without a password and MUST only be reached through the
# noVNC port on a trusted network / behind an authenticated proxy.
if [ -n "${VNC_PASSWORD:-}" ]; then
    x11vnc -storepasswd "$VNC_PASSWORD" /config/.vnc/passwd >/dev/null 2>&1
    chown app:app /config/.vnc/passwd
    chmod 600 /config/.vnc/passwd
    echo "[entrypoint] VNC password protection ENABLED"
else
    rm -f /config/.vnc/passwd
    echo "[entrypoint] WARNING: VNC_PASSWORD is not set — the desktop is"
    echo "[entrypoint] unauthenticated. Only expose port 6080 on a trusted"
    echo "[entrypoint] LAN or behind an authenticated reverse proxy."
fi

export VNC_GEOMETRY="${VNC_GEOMETRY:-1920x1080}"
echo "[entrypoint] Starting self-hosted GUI (geometry $VNC_GEOMETRY, PUID=$PUID PGID=$PGID)"
echo "[entrypoint] Web GUI: http://<host>:6080/vnc.html"
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
