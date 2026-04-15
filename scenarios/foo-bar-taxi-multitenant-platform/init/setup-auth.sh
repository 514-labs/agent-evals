#!/bin/bash
set -euo pipefail

echo "Setting up JWT auth materials in /data/auth/..."
mkdir -p /data/auth

# JWT secret
echo -n "decbench-taxi-jwt-secret-2024" > /data/auth/jwt-secret.txt

# Pre-generated static JWT tokens (HS256, secret = decbench-taxi-jwt-secret-2024)
# Header: {"alg":"HS256","typ":"JWT"}
# Yellow payload: {"tenant":"yellow","sub":"yellow-cab-co","iat":1704067200}
cat > /data/auth/yellow-tenant.jwt << 'EOF'
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnQiOiJ5ZWxsb3ciLCJzdWIiOiJ5ZWxsb3ctY2FiLWNvIiwiaWF0IjoxNzA0MDY3MjAwfQ.VL2uf69gdWC6io-wTB2t8gUkDi9qQaRDqFDiIiw_bIE
EOF

# Green payload: {"tenant":"green","sub":"green-cab-co","iat":1704067200}
cat > /data/auth/green-tenant.jwt << 'EOF'
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnQiOiJncmVlbiIsInN1YiI6ImdyZWVuLWNhYi1jbyIsImlhdCI6MTcwNDA2NzIwMH0.8rOXsbbR7S_07-krl5Bk1qELfdaQR2m-0J9BIwmcMWI
EOF

# README explaining the auth setup
cat > /data/auth/README.md << 'DOCEOF'
# JWT Auth Setup

## Files

- `jwt-secret.txt` -- HMAC-SHA256 signing secret for JWT verification
- `yellow-tenant.jwt` -- Pre-signed JWT for the yellow cab tenant
- `green-tenant.jwt` -- Pre-signed JWT for the green cab tenant

## Token structure

All tokens are signed with HS256 using the secret in `jwt-secret.txt`.

### Yellow tenant token payload
```json
{"tenant": "yellow", "sub": "yellow-cab-co", "iat": 1704067200}
```

### Green tenant token payload
```json
{"tenant": "green", "sub": "green-cab-co", "iat": 1704067200}
```

## Usage

Include the JWT in the `Authorization` header as a Bearer token:
```
Authorization: Bearer <contents of yellow-tenant.jwt or green-tenant.jwt>
```

The `tenant` claim determines which taxi type data the request can access.
DOCEOF

chmod 644 /data/auth/*
echo "Auth materials staged successfully."
