// Config-driven ICP verifier. The Apollo List is already intent+ICP qualified
// in the UI; this is a sanity re-check on the pulled records plus a score the
// runner can write into a GHL custom field.
//
// evaluate(contact, rules) -> { qualified: boolean, score: number, reasons: string[] }

function lc(s) {
  return (s || '').toString().toLowerCase();
}

export function evaluate(contact, rules = {}) {
  const reasons = [];
  let score = 0;
  let qualified = true;
  const w = rules.weights || {};

  // Required fields
  for (const field of rules.requireFields || []) {
    if (!contact[field]) {
      qualified = false;
      reasons.push(`missing_${field}`);
    }
  }

  // Title inclusion
  if (rules.titleIncludesAny?.length) {
    const t = lc(contact.title);
    const hit = rules.titleIncludesAny.some((k) => t.includes(lc(k)));
    if (hit) {
      score += w.title ?? 3;
      reasons.push('title_match');
    } else if (rules.titleRequired) {
      qualified = false;
      reasons.push('title_no_match');
    }
  }

  // Title exclusion (always disqualifies)
  if (rules.titleExcludesAny?.length) {
    const t = lc(contact.title);
    if (rules.titleExcludesAny.some((k) => t.includes(lc(k)))) {
      qualified = false;
      reasons.push('title_excluded');
    }
  }

  // Country allow-list
  if (rules.allowedCountries?.length) {
    const c = lc(contact.country);
    const allowed = rules.allowedCountries.map(lc);
    if (c && allowed.includes(c)) {
      score += w.country ?? 1;
      reasons.push('country_ok');
    } else if (rules.countryRequired) {
      qualified = false;
      reasons.push('country_not_allowed');
    }
  }

  // Competitor / excluded domains (always disqualifies)
  if (rules.excludeDomains?.length && contact.domain) {
    if (rules.excludeDomains.map(lc).includes(lc(contact.domain))) {
      qualified = false;
      reasons.push('competitor_domain');
    }
  }

  // Employee range (only applied when we have the number)
  if (contact.employees != null && Number.isFinite(Number(contact.employees))) {
    const n = Number(contact.employees);
    if (rules.minEmployees != null && n < rules.minEmployees) {
      qualified = false;
      reasons.push('too_small');
    } else if (rules.maxEmployees != null && n > rules.maxEmployees) {
      qualified = false;
      reasons.push('too_large');
    } else if (rules.minEmployees != null || rules.maxEmployees != null) {
      score += w.employees ?? 2;
      reasons.push('size_ok');
    }
  }

  // Minimum score gate
  if (rules.minScore != null && score < rules.minScore) {
    qualified = false;
    reasons.push(`below_min_score(${score})`);
  }

  return { qualified, score, reasons };
}
