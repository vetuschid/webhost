// Normalizers: raw source records -> a single canonical contact shape.
//
// Canonical shape:
// { firstName, lastName, name, email, phone, title, company, domain,
//   website, city, state, country, linkedinUrl, employees, source, raw }

export function domainFromEmail(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].trim().toLowerCase() || null;
}

export function domainFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url).startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export function normalizeApolloContact(c) {
  const email = clean(c.email)?.toLowerCase() || null;
  const org = c.organization || c.account || {};
  const rawWebsite = org.website_url || org.primary_domain || null;
  const website = rawWebsite
    ? String(rawWebsite).startsWith('http')
      ? rawWebsite
      : `https://${rawWebsite}`
    : null;
  const domain =
    clean(org.primary_domain)?.toLowerCase() || domainFromEmail(email) || domainFromUrl(website);
  const phone =
    c.phone_numbers?.[0]?.sanitized_number ||
    c.phone_numbers?.[0]?.raw_number ||
    clean(c.sanitized_phone) ||
    clean(c.phone) ||
    null;
  const firstName = clean(c.first_name);
  const lastName = clean(c.last_name);
  return {
    firstName,
    lastName,
    name: clean(c.name) || [firstName, lastName].filter(Boolean).join(' ') || null,
    email,
    phone,
    title: clean(c.title),
    company: clean(c.organization_name) || clean(org.name),
    domain,
    website,
    city: clean(c.city),
    state: clean(c.state),
    country: clean(c.country),
    linkedinUrl: clean(c.linkedin_url),
    employees: org.estimated_num_employees ?? null,
    source: 'apollo_list',
    raw: c,
  };
}

// Build a case/punctuation-insensitive index of a CSV row's keys.
function indexRow(row) {
  const idx = {};
  for (const k of Object.keys(row)) {
    idx[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k];
  }
  return idx;
}

export function normalizeCsvRow(row, mapping = {}) {
  const idx = indexRow(row);
  const pick = (canonical, ...aliases) => {
    // explicit mapping wins
    const mapped = mapping[canonical];
    if (mapped && row[mapped] != null && String(row[mapped]).trim() !== '') {
      return String(row[mapped]).trim();
    }
    for (const a of [canonical, ...aliases]) {
      const key = a.toLowerCase().replace(/[^a-z0-9]/g, '');
      const v = idx[key];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return null;
  };

  const email = pick('email', 'work_email', 'email_address')?.toLowerCase() || null;
  const website = pick('website', 'url');
  const firstName = pick('first_name', 'firstname', 'first');
  const lastName = pick('last_name', 'lastname', 'last');
  const domain =
    pick('domain')?.toLowerCase() || domainFromEmail(email) || domainFromUrl(website);

  return {
    firstName,
    lastName,
    name: pick('name', 'full_name') || [firstName, lastName].filter(Boolean).join(' ') || null,
    email,
    phone: pick('phone', 'phone_number', 'mobile'),
    title: pick('title', 'job_title'),
    company: pick('company', 'organization', 'account_name'),
    domain,
    website: website
      ? String(website).startsWith('http')
        ? website
        : `https://${website}`
      : null,
    city: pick('city'),
    state: pick('state', 'region'),
    country: pick('country'),
    linkedinUrl: pick('linkedin_url', 'linkedin'),
    employees: pick('employees', 'num_employees') ? Number(pick('employees', 'num_employees')) : null,
    source: 'csv',
    raw: row,
  };
}
