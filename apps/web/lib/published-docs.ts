// Add slugs here to make doc pages visible in the sidebar and accessible by URL.
// Empty array = index page (quickstart). Nested pages use path segments, e.g. ["evals", "domains", "foo-bar"].
export const PUBLISHED_SLUGS: string[][] = [
  [],                                              // /docs (quickstart)
  ["add-eval", "getting-started"],                 // Add a Scenario
  ["add-eval", "writing-assertions"],              // Writing Assertions
  ["add-eval", "adding-multiple-services"],        // Adding Multiple Services
  ["add-eval", "adding-persona-prompts"],          // Adding Persona Prompts
  ["add-eval", "calibrating-scenarios"],           // Calibrating and Maintaining Scenarios
];

export function isPublished(slug: string[] | undefined): boolean {
  const s = slug ?? [];
  return PUBLISHED_SLUGS.some(
    (p) => p.length === s.length && p.every((v, i) => v === s[i]),
  );
}
