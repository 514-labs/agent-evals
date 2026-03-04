Evolve the `orders` topic schema to add an optional `region` (string, default null) field while maintaining backward compatibility.

Requirements:
1. Update the schema (Avro/JSON Schema) so `region` is optional and defaults to null for existing messages.
2. Ensure producers can send messages with or without `region`.
3. Ensure consumers can read both old (no region) and new (with region) message formats without failing.
4. Document the schema evolution approach used (e.g., additive-only, default values).