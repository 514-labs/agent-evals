#!/usr/bin/env bash
set -euo pipefail

iptables -A OUTPUT -o lo -j ACCEPT
iptables -P OUTPUT DROP
iptables -I OUTPUT -d api.anthropic.com -j ACCEPT
