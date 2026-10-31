const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** The engine writes animals by id; show labels the viewer may see, and a neutral phrase otherwise. */
export function labelize(text: string, labels: Map<string, string> | Record<string, string>) {
  const get = (id: string) => (labels instanceof Map ? labels.get(id) : labels[id]);
  return text.replace(UUID_RE, (id) => get(id.toLowerCase()) ?? "an animal on a farm you can't see");
}

export function idsIn(value: unknown): string[] {
  return JSON.stringify(value).match(UUID_RE) ?? [];
}

/** Start a sentence with a capital letter. */
export function sentence(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
