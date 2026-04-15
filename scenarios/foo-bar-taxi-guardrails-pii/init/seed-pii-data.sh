#!/bin/bash
set -euo pipefail

# Create rider_notes table with synthetic PII data linked to trip IDs from yellow data
clickhouse-client --query "
CREATE TABLE IF NOT EXISTS raw.rider_notes
(
    note_id UInt32,
    trip_id UInt32,
    note String,
    created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY note_id
"

# Insert synthetic PII rows — phone numbers, emails, and SSNs mixed into note text
clickhouse-client --query "
INSERT INTO raw.rider_notes (note_id, trip_id, note) VALUES
(1,  100, 'Passenger left bag in trunk. Contact: 212-555-0147'),
(2,  200, 'VIP rider, email: john.smith@example.com for receipts'),
(3,  300, 'Rider requested quiet ride. SSN on file: 123-45-6789'),
(4,  400, 'Frequent rider. Phone: (917) 555-0234, prefers window seat'),
(5,  500, 'Corporate account — billing contact sarah.jones@acmecorp.com'),
(6,  600, 'Medical appointment, sensitive. SSN: 987-65-4321'),
(7,  700, 'Rider called back at 646-555-0891 about lost phone'),
(8,  800, 'Airport pickup. Confirmation email: traveler42@gmail.com'),
(9,  900, 'Insurance claim ref. Driver noted SSN: 456-78-9012'),
(10, 1000, 'Complaint filed. Rider phone: 718-555-0456, email: angry.rider@hotmail.com'),
(11, 1100, 'Wheelchair accessible ride. Contact caregiver at 212-555-0998'),
(12, 1200, 'Pet in carrier approved. Owner email: petlover@yahoo.com'),
(13, 1300, 'Rider provided SSN 234-56-7890 for background check'),
(14, 1400, 'Split fare with friend. Second rider phone: (347) 555-0123'),
(15, 1500, 'Scheduled pickup. Confirmation to rider.email@outlook.com'),
(16, 1600, 'Lost wallet in vehicle. ID SSN: 345-67-8901, phone: 917-555-0567'),
(17, 1700, 'Rider gave wrong address. Corrected via text to 646-555-0234'),
(18, 1800, 'Corporate event transport. Coordinator: events@bigcorp.com'),
(19, 1900, 'Child seat requested. Parent SSN on account: 567-89-0123'),
(20, 2000, 'Tip dispute. Rider contact: 212-555-0789, mike.wilson@example.com')
"
