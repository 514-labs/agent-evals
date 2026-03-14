const SIDECAR_SUFFIXES = [
  ".agent-raw.json",
  ".trace.json",
  ".assertion-log.json",
  ".run-meta.json",
  ".session.jsonl",
  ".infra.stdout",
  ".stdout",
  ".stderr",
];

export function isSidecarFile(name: string): boolean {
  return SIDECAR_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

export function isCanonicalResultFile(name: string): boolean {
  return name.endsWith(".json") && !isSidecarFile(name);
}
