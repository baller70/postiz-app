#!/bin/bash
# Check if backend is on port 3000
if ! docker exec postiz ss -tlnp 2>/dev/null | grep -q ":3000"; then
    docker exec postiz sh -c "env > /app/.env" 2>/dev/null
    docker exec postiz pm2 restart backend 2>/dev/null
fi
# Ensure UDP 443 is open
iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null || iptables -I INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null
