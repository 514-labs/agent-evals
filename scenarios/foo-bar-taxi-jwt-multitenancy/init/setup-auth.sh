#!/bin/bash
set -euo pipefail

mkdir -p /data/auth

# Shared JWT secret
echo -n "decbench-taxi-jwt-secret-2024" > /data/auth/jwt-secret.txt

# Pre-signed JWT for yellow tenant
# Header: {"alg":"HS256","typ":"JWT"}
# Payload: {"tenant":"yellow","sub":"user1","iat":1704067200,"exp":1893456000}
# Signed with secret "decbench-taxi-jwt-secret-2024"
HEADER=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
YELLOW_PAYLOAD=$(echo -n '{"tenant":"yellow","sub":"user1","iat":1704067200,"exp":1893456000}' | base64 -w0 | tr '+/' '-_' | tr -d '=')
GREEN_PAYLOAD=$(echo -n '{"tenant":"green","sub":"user2","iat":1704067200,"exp":1893456000}' | base64 -w0 | tr '+/' '-_' | tr -d '=')

SECRET="decbench-taxi-jwt-secret-2024"
YELLOW_SIGNATURE=$(echo -n "${HEADER}.${YELLOW_PAYLOAD}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | base64 -w0 | tr '+/' '-_' | tr -d '=')
GREEN_SIGNATURE=$(echo -n "${HEADER}.${GREEN_PAYLOAD}" | openssl dgst -sha256 -hmac "${SECRET}" -binary | base64 -w0 | tr '+/' '-_' | tr -d '=')

echo -n "${HEADER}.${YELLOW_PAYLOAD}.${YELLOW_SIGNATURE}" > /data/auth/yellow-tenant.jwt
echo -n "${HEADER}.${GREEN_PAYLOAD}.${GREEN_SIGNATURE}" > /data/auth/green-tenant.jwt

cat > /data/auth/README.md << 'AUTHEOF'
# JWT Auth Setup

## Shared Secret
- File: `jwt-secret.txt`
- Algorithm: HS256

## Pre-signed Tokens

### yellow-tenant.jwt
- Claims: `{"tenant": "yellow", "sub": "user1"}`
- Use this token to authenticate as the yellow-cab operator.

### green-tenant.jwt
- Claims: `{"tenant": "green", "sub": "user2"}`
- Use this token to authenticate as the green-cab operator.

## Expected Usage
- Send the JWT in the `Authorization` header as a Bearer token.
- The `tenant` claim determines which taxi_type rows the user can access.
AUTHEOF

chmod -R 644 /data/auth/*
chmod 755 /data/auth
