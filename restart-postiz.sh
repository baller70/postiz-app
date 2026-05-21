#!/bin/bash
cd /opt/apps/postiz
docker compose up -d
echo "Waiting 20s for Postiz to start..."
sleep 20
/opt/apps/postiz/patch-auto-login.sh
docker restart postiz
echo "Postiz restarted with auto-login patches."
