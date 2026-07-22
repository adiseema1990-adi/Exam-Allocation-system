import { ExamAllocation, Faculty } from './types';

/**
 * Normalizes a faculty name for comparison (strips titles like Dr., Prof., punctuation, extra spaces).
 */
export function normalizeFacultyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(dr|prof|mr|mrs|ms|er)\b\.?/gi, '') // Strip common honorifics
    .replace(/[^a-z0-9]/g, ' ')                   // Replace non-alphanumeric chars with space
    .replace(/\s+/g, ' ')                         // Collapse multiple spaces
    .trim();
}

/**
 * Smartly finds a faculty member from a faculties list matching a given name.
 */
export function findFaculty(faculties: Faculty[] | undefined, searchName: string): Faculty | undefined {
  if (!faculties || faculties.length === 0 || !searchName || !searchName.trim()) {
    return undefined;
  }

  const cleanSearch = searchName.trim().toLowerCase();

  // 1. Exact match (case-insensitive)
  const exact = faculties.find(f => f.name.trim().toLowerCase() === cleanSearch);
  if (exact) return exact;

  // 2. Normalized match (stripping titles & special chars)
  const normSearch = normalizeFacultyName(searchName);
  if (normSearch) {
    const normMatch = faculties.find(f => normalizeFacultyName(f.name) === normSearch);
    if (normMatch) return normMatch;

    // 3. Substring / Inclusion match
    const subMatch = faculties.find(f => {
      const fn = normalizeFacultyName(f.name);
      return fn.length > 3 && normSearch.length > 3 && (fn.includes(normSearch) || normSearch.includes(fn));
    });
    if (subMatch) return subMatch;

    // 4. Word Overlap match (e.g. "Ramesh Kumar" vs "Dr. Ramesh Kumar S")
    const searchWords = normSearch.split(' ').filter(w => w.length > 1);
    if (searchWords.length > 0) {
      const wordMatch = faculties.find(f => {
        const facWords = normalizeFacultyName(f.name).split(' ').filter(w => w.length > 1);
        const searchInFac = searchWords.every(sw => facWords.some(fw => fw.includes(sw) || sw.includes(fw)));
        const facInSearch = facWords.every(fw => searchWords.some(sw => sw.includes(fw) || fw.includes(sw)));
        return searchInFac || facInSearch;
      });
      if (wordMatch) return wordMatch;
    }
  }

  return undefined;
}

/**
 * Trims whitespace and capitalizes each word of a name properly.
 * E.g., "  dr. john doe  " -> "Dr. John Doe"
 */
export function sanitizeAndCapitalizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ') // remove multiple spaces
    .split(' ')
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Format string date (YYYY-MM-DD) into displayable format (e.g., Jun 21, 2026)
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format timestamp value (Firestore or Date/Number) to visual locale string.
 */
export function formatTimestamp(createdAt: any): string {
  if (!createdAt) return 'Just now';
  
  try {
    // If it's a Firestore Timestamp {seconds, nanoseconds}
    if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
      return new Date(createdAt.seconds * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return 'Just now';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Just now';
  }
}

/**
 * Check if today's date matches the allocation date
 */
export function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  // Get local date as YYYY-MM-DD
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  return dateStr === todayStr;
}

/**
 * Perform filter matches for Search
 */
export function matchesSearch(allocation: ExamAllocation, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const nameMatch = allocation.facultyName.toLowerCase().includes(q);
  const deptMatch = allocation.department.toLowerCase().includes(q);
  return nameMatch || deptMatch;
}
