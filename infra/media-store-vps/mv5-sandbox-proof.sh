#!/bin/sh
# MV-5 sandbox proof ceremony. Run ON THE VPS as hebun-admin from a directory holding this script,
# mv5_sandbox_proof.py and the NEW hebun_media_store.py. Writes no store data; leaves nothing behind.
set -eu
DIR=/opt/hebun-mv5-proof
sudo install -d -o root -g root -m 0755 "$DIR"
sudo install -o root -g root -m 0644 hebun_media_store.py mv5_sandbox_proof.py "$DIR/"
sudo systemd-run --wait --pipe --collect --quiet \
  -p User=hebun-media -p Group=hebun-media -p UMask=0077 \
  -p NoNewPrivileges=yes -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes -p PrivateDevices=yes \
  -p ProtectKernelTunables=yes -p ProtectKernelModules=yes -p ProtectKernelLogs=yes -p ProtectControlGroups=yes \
  -p ProtectClock=yes -p ProtectHostname=yes -p "RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX" \
  -p RestrictNamespaces=yes -p RestrictRealtime=yes -p RestrictSUIDSGID=yes -p LockPersonality=yes \
  -p MemoryDenyWriteExecute=yes -p SystemCallArchitectures=native -p CapabilityBoundingSet= \
  -p MemoryMax=512M -p TasksMax=64 \
  /usr/bin/python3 -I "$DIR/mv5_sandbox_proof.py" || status=$?
sudo rm -rf "$DIR"
exit "${status:-0}"
