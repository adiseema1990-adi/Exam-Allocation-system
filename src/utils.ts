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
 * Normalizes any date string into standard ISO format (YYYY-MM-DD).
 * Supports YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, MM/DD/YYYY, and Date objects/strings.
 */
export function normalizeDateToISO(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';

  // 1. If ISO format YYYY-MM-DD or starts with YYYY-MM-DD (e.g. 2026-08-24 or 2026-08-24T...)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. If YYYY/MM/DD or YYYY.MM.DD
  const yFirstMatch = trimmed.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
  if (yFirstMatch) {
    const y = yFirstMatch[1];
    const m = yFirstMatch[2].padStart(2, '0');
    const d = yFirstMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 3. If DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY or MM/DD/YYYY
  const dFirstMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dFirstMatch) {
    const p1 = parseInt(dFirstMatch[1], 10);
    const p2 = parseInt(dFirstMatch[2], 10);
    const y = dFirstMatch[3];
    let d = p1;
    let m = p2;
    
    // If p2 > 12, then p1 must be month and p2 is day (MM/DD/YYYY)
    if (p2 > 12 && p1 <= 12) {
      m = p1;
      d = p2;
    }
    // If p1 > 12, then p1 is day and p2 is month (DD/MM/YYYY)
    else if (p1 > 12 && p2 <= 12) {
      d = p1;
      m = p2;
    }
    // Default in Indian / collegiate context is DD/MM/YYYY
    
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 4. Try JS Date parsing (for textual dates like "24 Aug 2026" or "August 24, 2026")
  try {
    const dObj = new Date(trimmed);
    if (!isNaN(dObj.getTime())) {
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch {
    // fallback
  }

  return trimmed;
}

/**
 * Checks if two date representations point to the exact same calendar date.
 */
export function isSameDate(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  return normalizeDateToISO(dateA) === normalizeDateToISO(dateB);
}

/**
 * Normalizes session strings (e.g. 'Forenoon', 'FN', 'morning', 'AN', 'Afternoon', 'Full Day')
 */
export function normalizeSession(sessionStr: string): 'Morning' | 'Afternoon' | 'Full Day' {
  if (!sessionStr) return 'Morning';
  const s = sessionStr.toLowerCase().trim();
  if (s.includes('after') || s.includes('an') || s.includes('pm')) {
    return 'Afternoon';
  }
  if (s.includes('full') || s.includes('both') || s.includes('fd')) {
    return 'Full Day';
  }
  if (s.includes('morn') || s.includes('forenoon') || s.includes('fn') || s.includes('mn') || s.includes('am')) {
    return 'Morning';
  }
  return 'Morning';
}

/**
 * Checks if an allocation's session matches a target session filter.
 * Note: 'Full Day' allocations cover both Morning and Afternoon duties.
 */
export function matchesSession(allocationSession: string, targetSession: 'Morning' | 'Afternoon' | 'Full Day'): boolean {
  const normAlloc = normalizeSession(allocationSession);
  if (targetSession === 'Full Day') {
    return normAlloc === 'Full Day';
  }
  return normAlloc === targetSession || normAlloc === 'Full Day';
}

/**
 * Format string date (YYYY-MM-DD or DD/MM/YYYY or timestamp) into displayable format (e.g., Aug 24, 2026)
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const iso = normalizeDateToISO(dateStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [yearStr, monthStr, dayStr] = iso.split('-');
      const year = parseInt(yearStr, 10);
      const monthIndex = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      // Create local date object avoiding timezone shift bugs
      const date = new Date(year, monthIndex, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
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
  return normalizeDateToISO(dateStr) === todayStr;
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
