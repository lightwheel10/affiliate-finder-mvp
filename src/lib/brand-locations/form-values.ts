export function parseUniqueLineValues(value: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const rawValue of value.split(/\r?\n/)) {
    const trimmed = rawValue.trim();
    const normalized = trimmed.toLocaleLowerCase('en-US');
    if (!trimmed || seen.has(normalized)) continue;
    seen.add(normalized);
    values.push(trimmed);
  }
  return values;
}

export function formatLineValues(values: readonly string[]): string {
  return values.join('\n');
}
