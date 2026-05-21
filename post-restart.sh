#!/bin/bash
# Wait for container to be healthy
sleep 5
# Ensure UDP 443 is open for HTTP/3
iptables -I INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null
