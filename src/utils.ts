import { ExamAllocation } from './types';

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
