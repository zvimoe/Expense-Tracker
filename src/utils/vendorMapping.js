import Papa from 'papaparse';

/**
 * Parse a vendor-mapping-override CSV.
 *
 * Expected columns (case-insensitive, spaces/underscores interchangeable):
 *   vendor            – the original vendor name to match (required)
 *   mapped_vendor     – canonical name to use instead   (optional, blank = keep original)
 *   category_override – category to use instead         (optional, blank = keep original)
 */
export function parseMappingCSV(content) {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: 'greedy',
    // Normalise header: lowercase, collapse spaces/underscores
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s_]+/g, '_'),
  });

  return (result.data || [])
    .map((row) => ({
      vendor:           (row.vendor           || '').trim(),
      mappedVendor:     (row.mapped_vendor     || '').trim(),
      categoryOverride: (row.category_override || '').trim(),
    }))
    .filter((m) => m.vendor); // must have at least the source vendor name
}

/**
 * Apply a mapping list to a transaction array.
 * Matching is case-insensitive on the vendor name.
 *
 * - mappedVendor set     → replace t.vendor
 * - categoryOverride set → replace t.category
 * Missing / blank values leave the original field unchanged.
 */
export function applyMappings(transactions, mappings) {
  if (!mappings || mappings.length === 0) return transactions;

  // Build a lookup keyed by lowercase vendor name
  const lookup = new Map();
  for (const m of mappings) {
    lookup.set(m.vendor.toLowerCase(), m);
  }

  return transactions.map((t) => {
    const m = lookup.get(t.vendor.toLowerCase());
    if (!m) return t;
    return {
      ...t,
      vendor:   m.mappedVendor     || t.vendor,
      category: m.categoryOverride || t.category,
    };
  });
}

/**
 * Serialise a mappings array back to a CSV string ready to be saved.
 */
export function exportMappingCSV(mappings) {
  return Papa.unparse({
    fields: ['vendor', 'mapped_vendor', 'category_override'],
    data: mappings.map((m) => [
      m.vendor,
      m.mappedVendor,
      m.categoryOverride,
    ]),
  });
}

/**
 * Collect unique vendor names from a transaction list (sorted A-Z).
 */
export function uniqueVendors(transactions) {
  const s = new Set(transactions.map((t) => t.vendor));
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

/**
 * Collect unique category names from a transaction list + any extra categories
 * already defined in the current mapping set (sorted A-Z).
 */
export function uniqueCategories(transactions, mappings = []) {
  const s = new Set(transactions.map((t) => t.category));
  for (const m of mappings) {
    if (m.categoryOverride) s.add(m.categoryOverride);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}
