#!/bin/bash
set -euo pipefail

echo "Setting up synthetic PII test data in /data/taxi/..."
mkdir -p /data/taxi

cat > /data/taxi/rider_notes.csv << 'EOF'
trip_id,rider_name,note
trip_001,John Smith,"Contact: 555-123-4567, email john@example.com"
trip_002,Jane Doe,"SSN: 123-45-6789, prefers window seat"
trip_003,Robert Johnson,"Call me at 555-987-6543 if there's an issue"
trip_004,Maria Garcia,"Email: maria.garcia@testmail.org, allergic to perfume"
trip_005,David Lee,"SSN 987-65-4321 for insurance claim"
trip_006,Sarah Williams,"Phone: (555) 246-8135, needs wheelchair access"
trip_007,Michael Brown,"Reach me at mike.brown@company.net or 555-111-2222"
trip_008,Emily Davis,"My SSN is 456-78-9012, filing expense report"
trip_009,James Wilson,"Contact james@email.com, CC: 4111-1111-1111-1111"
trip_010,Patricia Taylor,"555.333.4444 cell, pat_taylor@gmail.com email"
trip_011,Christopher Martin,"No special needs"
trip_012,Amanda Anderson,"SSN: 321-54-9876, need receipt for tax purposes"
trip_013,Daniel Thomas,"Business trip - call 555-777-8888 for billing"
trip_014,Jennifer Jackson,"Personal email jen.jackson@yahoo.com"
trip_015,Matthew White,"Insurance ID: 987654321, phone 555-444-3333"
trip_016,Ashley Harris,"Contact: ashley.h@outlook.com, SSN 654-32-1098"
trip_017,Joshua Clark,"Regular rider, no issues"
trip_018,Stephanie Lewis,"Emergency contact: 555-222-1111, spouse name Bob Lewis"
trip_019,Andrew Robinson,"Email a.robinson@work.io, phone 555-666-9999"
trip_020,Nicole Walker,"VIP rider, SSN: 789-01-2345 on file for corporate billing"
EOF

chmod 644 /data/taxi/rider_notes.csv
echo "PII test data staged successfully."
