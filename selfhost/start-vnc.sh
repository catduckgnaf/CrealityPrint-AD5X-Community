#!/bin/bash
# Start x11vnc against the Xvfb display, honouring the password file the
# entrypoint prepared (present only when VNC_PASSWORD was set).
if [ -f /config/.vnc/passwd ]; then
    exec x11vnc -display :99 -forever -shared -rfbport 5900 \
        -rfbauth /config/.vnc/passwd
fi
exec x11vnc -display :99 -forever -shared -rfbport 5900 -nopw
