/**
 * Utility functions for workflow column matching and transition guard validations.
 */

export function normalizeColumnTitle(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

export function getColumnCategory(norm: string): string {
  if (!norm) return '';

  // 1. TODO / Backlog
  if (/todo|yapilacak|backlog|open|acik|beklemede|tanimlandi|analiz|plan/.test(norm)) {
    return 'TODO';
  }

  // 2. IN_PROGRESS / Development
  if (/inprogress|gelistirmede|dev|suruyor|devamediyor|islemde|calisiliyor|yapiliyor|doing|active|aktif|kodlama|progress/.test(norm)) {
    return 'IN_PROGRESS';
  }

  // 3. IN_REVIEW / QA / Testing
  if (/inreview|review|test|qa|inceleme|kontrol|dogrulama|codereview|onay|denetim/.test(norm)) {
    return 'IN_REVIEW';
  }

  // 4. DONE / Completed
  if (/done|tamamlandi|bitti|kapandi|completed|closed|finish|finished|sonuclandi|yayinda|deploy/.test(norm)) {
    return 'DONE';
  }

  return norm;
}

export function isColumnMatching(ruleTitle?: string | null, boardTitle?: string | null): boolean {
  if (!ruleTitle || !boardTitle) return false;
  const norm1 = normalizeColumnTitle(ruleTitle);
  const norm2 = normalizeColumnTitle(boardTitle);

  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  const cat1 = getColumnCategory(norm1);
  const cat2 = getColumnCategory(norm2);
  if (cat1 && cat1 === cat2) return true;

  return false;
}

export const CATEGORY_COLORS: Record<string, string> = {
  TODO: '#64748B',
  IN_PROGRESS: '#3B82F6',
  IN_REVIEW: '#F59E0B',
  DONE: '#10B981',
};

export function getColumnColor(title?: string | null, customHex?: string | null): string {
  if (customHex && customHex.trim().length >= 4) {
    return customHex.trim();
  }
  const norm = normalizeColumnTitle(title);
  const category = getColumnCategory(norm);
  if (category && CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  return '#6366F1'; // Default Indigo
}

