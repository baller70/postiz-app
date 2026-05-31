#!/bin/bash
# Ensures Caddy is pointing to the correct Postiz container IP.
# Run after any docker compose down/up.
CURRENT_IP=$(docker inspect postiz --format '{{range $k, $v := .NetworkSettings.Networks}}{{if eq $k "postiz_postiz-network"}}{{$v.IPAddress}}{{end}}{{end}}' 2>/dev/null)
if [ -z "$CURRENT_IP" ]; then
  echo "ERROR: Postiz container not running"
  exit 1
fi
CADDY_IP=$(grep -oP '(?<=reverse_proxy )[\d.]+(?::5000)' /etc/caddy/Caddyfile | grep -oP '[\d.]+' | head -1)
if [ "$CURRENT_IP" = "$CADDY_IP" ]; then
  echo "OK: Caddy already points to $CURRENT_IP"
else
  echo "UPDATING: Caddy $CADDY_IP -> $CURRENT_IP"
  sed -i "s|reverse_proxy ${CADDY_IP}:5000|reverse_proxy ${CURRENT_IP}:5000|" /etc/caddy/Caddyfile
  caddy reload --config /etc/caddy/Caddyfile 2>&1
  echo "DONE: Caddy reloaded with $CURRENT_IP"
fi
