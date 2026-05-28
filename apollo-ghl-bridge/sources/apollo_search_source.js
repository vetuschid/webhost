// FUTURE STUB — intentionally inert in V1.
//
// Apollo's People Search API (POST /api/v1/mixed_people/search) hits the
// 210M net-new database. It does NOT expose buying intent (UI-only) and does
// NOT return email addresses. Recreating the intent+ICP list via the search
// API is therefore not possible, so this adapter is a placeholder to preserve
// the adapter interface for a future enrichment/prospecting flow.
//
// Do not wire this into the runners until there is a real use case
// (e.g. net-new prospecting + /people/bulk_match enrichment, which burns
// Apollo credits).

export async function fetch() {
  throw new Error(
    'apollo_search_source is a future stub. Apollo People Search has no intent data and no ' +
      'emails; use apollo_list_source (saved List via /contacts/search) instead.',
  );
}
