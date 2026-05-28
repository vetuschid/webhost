// In-batch dedupe of the pulled source set: email first, then domain.
// This collapses duplicates WITHIN the source pull only. Matching against
// contacts that already exist in GHL is handled by GHL's location-level
// "Allow Duplicate Contact" setting, NOT here.

export function dedupeKey(contact) {
  if (contact.email) return `email:${contact.email.toLowerCase()}`;
  if (contact.domain) return `domain:${contact.domain.toLowerCase()}`;
  if (contact.name) return `name:${contact.name.toLowerCase()}`;
  return null;
}

export function dedupe(contacts) {
  const seen = new Map();
  const unique = [];
  const duplicates = [];
  for (const c of contacts) {
    const key = dedupeKey(c);
    if (key === null) {
      // No usable identity — keep it but flag.
      unique.push(c);
      continue;
    }
    if (seen.has(key)) {
      duplicates.push({ contact: c, key, keptEmail: seen.get(key) });
      continue;
    }
    seen.set(key, c.email || c.domain || c.name);
    unique.push(c);
  }
  return { unique, duplicates };
}
