#!/usr/bin/env bash
set -euo pipefail

iptables -A OUTPUT -o lo -j ACCEPT
iptables -P OUTPUT DROP
iptables -I OUTPUT -d api.cursor.sh -j ACCEPT
iptables -I OUTPUT -d api2.cursor.sh -j ACCEPT
