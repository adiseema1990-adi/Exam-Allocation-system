import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Check, 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  Search, 
  Filter,
  AlertCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ExamAllocation, Faculty, Department, Session } from '../types';
import { formatDisplayDate, findFaculty, normalizeDateToISO, normalizeSession } from '../utils';

interface FacultyDutyGridProps {
  allocations: ExamAllocation[];
  faculties: Faculty[];
  isAdmin: boolean;
  onLoginClick: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  addAllocation: (record: Omit<ExamAllocation, 'id' | 'createdAt'>) => Promise<void>;
  removeAllocation: (id: string) => Promise<void>;
}

export function FacultyDutyGrid({
  allocations,
  faculties,
  isAdmin,
  onLoginClick,
  showToast,
  addAllocation: apiAddAllocation,
  removeAllocation: apiRemoveAllocation
}: FacultyDutyGridProps) {
  // Get date strings for default range (today + 4 days)
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getFutureString = (daysAhead: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // State
  const [fromDate, setFromDate] = useState<string>(getTodayString());
  const [toDate, setToDate] = useState<string>(getFutureString(4));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  // Selections in draft state
  // Key: "facultyName::date::session" -> boolean
  const [draftAdditions, setDraftAdditions] = useState<Record<string, boolean>>({});
  // Key: allocationId -> boolean
  const [draftDeletions, setDraftDeletions] = useState<Record<string, boolean>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scroll synchronization refs & state
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  // Escape key listener to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Lock body scroll when in full screen
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullScreen]);

  // Helper to extract compact date parts (day number, short month, weekday)
  const getCompactDateParts = (isoDate: string) => {
    try {
      const [y, m, d] = isoDate.split('-');
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      return { 
        day: parseInt(d, 10), 
        month, 
        weekday, 
        full: formatDisplayDate(isoDate) 
      };
    } catch {
      return { 
        day: '', 
        month: isoDate, 
        weekday: '', 
        full: isoDate 
      };
    }
  };

  // Departments list for filter
  const departments: (Department | 'All')[] = [
    'All', 'CSE', 'ECE', 'Mechanical', 'Civil', 'AIML', 'MBA', 
    'Mathematics', 'Physics', 'Chemistry', 'Humanities', 'Others'
  ];

  // Calculate full date range list (inclusive)
  const dateList = useMemo(() => {
    if (!fromDate || !toDate) return [];
    
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    // Safety guard for crazy range
    if (start > end) return [];
    
    const dates: string[] = [];
    const current = new Date(start);
    
    // Allow up to 25 days with compressed columns for maximum date visibility
    let count = 0;
    while (current <= end && count < 25) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
      count++;
    }
    return dates;
  }, [fromDate, toDate]);

  const isRangeTooLarge = useMemo(() => {
    if (!fromDate || !toDate) return false;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 25;
  }, [fromDate, toDate]);

  // Index allocations for super fast lookup
  // Map: facultyName (lowercase) -> date -> session -> ExamAllocation
  const allocationLookup = useMemo(() => {
    const lookup: Record<string, Record<string, Record<string, ExamAllocation>>> = {};
    allocations.forEach(alloc => {
      const nameKey = alloc.facultyName.trim().toLowerCase();
      const dateKey = normalizeDateToISO(alloc.date);
      const sessionKey = normalizeSession(alloc.session);
      if (!lookup[nameKey]) {
        lookup[nameKey] = {};
      }
      if (!lookup[nameKey][dateKey]) {
        lookup[nameKey][dateKey] = {};
      }
      
      // Map both Morning/Afternoon or handle normal sessions
      if (sessionKey === 'Morning' || sessionKey === 'Afternoon') {
        lookup[nameKey][dateKey][sessionKey] = alloc;
      } else if (sessionKey === 'Full Day') {
        // If assigned for full day, block both Morning and Afternoon
        lookup[nameKey][dateKey]['Morning'] = alloc;
        lookup[nameKey][dateKey]['Afternoon'] = alloc;
      }
    });
    return lookup;
  }, [allocations]);

  // Filter and sort faculty members
  const filteredFaculties = useMemo(() => {
    return faculties
      .filter(fac => {
        const matchesSearch = fac.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
        const matchesDept = selectedDept === 'All' || fac.department === selectedDept;
        return matchesSearch && matchesDept;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [faculties, searchQuery, selectedDept]);

  // Synchronize top and bottom scrollbars
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;
    if (!topScroll || !tableScroll) return;

    let isSyncingTop = false;
    let isSyncingTable = false;

    const handleTopScroll = () => {
      if (!isSyncingTable) {
        isSyncingTop = true;
        tableScroll.scrollLeft = topScroll.scrollLeft;
      }
      isSyncingTable = false;
    };

    const handleTableScroll = () => {
      if (!isSyncingTop) {
        isSyncingTable = true;
        topScroll.scrollLeft = tableScroll.scrollLeft;
      }
      isSyncingTop = false;
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
    };
  }, [tableScrollWidth]);

  // Monitor table size changes to update the top scrollbar inner width
  useEffect(() => {
    const measure = () => {
      if (tableRef.current) {
        setTableScrollWidth(tableRef.current.scrollWidth);
      }
    };
    
    measure();
    
    if (tableRef.current) {
      const observer = new ResizeObserver(measure);
      observer.observe(tableRef.current);
      return () => observer.disconnect();
    }
  }, [dateList, filteredFaculties]);

  // Handler for cell clicks
  const handleCellClick = (faculty: Faculty, date: string, session: Session) => {
    if (!isAdmin) {
      showToast('Authentication required to modify duty distributions.', 'warning');
      onLoginClick();
      return;
    }

    const nameKey = faculty.name.trim().toLowerCase();
    const existing = allocationLookup[nameKey]?.[date]?.[session];
    const draftKey = `${faculty.name.trim()}::${date}::${session}`;

    if (existing) {
      // Cell is already allocated in database. Clicking it toggles draft deletion!
      setDraftDeletions(prev => {
        const updated = { ...prev };
        if (updated[existing.id]) {
          delete updated[existing.id]; // restore
        } else {
          updated[existing.id] = true; // mark for deletion
        }
        return updated;
      });
    } else {
      // Cell is unallocated. Clicking it toggles draft addition!
      setDraftAdditions(prev => {
        const updated = { ...prev };
        if (updated[draftKey]) {
          delete updated[draftKey];
        } else {
          updated[draftKey] = true;
        }
        return updated;
      });
    }
  };

  // Helper to determine status and style of a cell
  const getCellStatus = (faculty: Faculty, date: string, session: Session) => {
    const nameKey = faculty.name.trim().toLowerCase();
    const existing = allocationLookup[nameKey]?.[date]?.[session];
    const draftKey = `${faculty.name.trim()}::${date}::${session}`;

    const isDeletePending = existing ? !!draftDeletions[existing.id] : false;
    const isAddPending = !existing ? !!draftAdditions[draftKey] : false;

    if (existing) {
      if (isDeletePending) {
        return {
          type: 'delete-pending' as const,
          label: 'REM',
          className: 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 hover:scale-[1.04] hover:shadow-md border-dashed line-through transition-all duration-150',
          tooltip: 'Draft Removal: duty will be de-allocated on Submit'
        };
      }
      return {
        type: 'allocated' as const,
        label: 'OK',
        className: 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100 hover:scale-[1.04] hover:shadow-md font-black transition-all duration-150',
        tooltip: `Duty Allocated: ${existing.isAdjusted ? 'Adjusted / Emergency Shift' : 'Standard Assignment'}`
      };
    }

    if (isAddPending) {
      return {
        type: 'add-pending' as const,
        label: '+ADD',
        className: 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100 hover:scale-[1.04] hover:shadow-md border-dashed animate-pulse font-black shadow-xs transition-all duration-150',
        tooltip: 'Draft Selection: duty will be allocated on Submit'
      };
    }

    // Default empty cell
    return {
      type: 'empty' as const,
      label: '',
      className: 'bg-transparent border-slate-150 text-slate-300 hover:bg-blue-100/90 hover:text-blue-900 hover:scale-[1.04] hover:shadow-md cursor-pointer transition-all duration-150',
      tooltip: 'Click to select and allocate exam duty'
    };
  };

  // Clear all pending draft changes
  const handleResetDrafts = () => {
    setDraftAdditions({});
    setDraftDeletions({});
    showToast('Draft grid selections reset', 'info');
  };

  // Submit all changes to Firebase
  const handleSubmitAllocations = async () => {
    const numAdditions = Object.keys(draftAdditions).length;
    const numDeletions = Object.keys(draftDeletions).length;

    if (numAdditions === 0 && numDeletions === 0) {
      showToast('No pending selections to submit.', 'info');
      return;
    }

    setIsSubmitting(true);
    let successes = 0;
    let failures = 0;

    try {
      // 1. Process deletions
      const deletionIds = Object.keys(draftDeletions);
      for (const id of deletionIds) {
        try {
          await apiRemoveAllocation(id);
          successes++;
        } catch (err) {
          console.error(`Failed to delete allocation ${id}:`, err);
          failures++;
        }
      }

      // 2. Process additions
      const additionKeys = Object.keys(draftAdditions);
      for (const key of additionKeys) {
        const [facName, date, session] = key.split('::');
        const facObj = findFaculty(faculties, facName);
        const department = facObj?.department || 'Others';

        try {
          await apiAddAllocation({
            facultyName: facName,
            department: department as Department,
            date,
            session: session as Session
          });
          successes++;
        } catch (err) {
          console.error(`Failed to add allocation for ${facName}:`, err);
          failures++;
        }
      }

      // Update feedback
      if (failures === 0) {
        showToast(`Successfully processed all ${successes} duty changes!`, 'success');
      } else {
        showToast(`Processed ${successes} changes with ${failures} errors.`, 'warning');
      }

      // Reset draft state
      setDraftAdditions({});
      setDraftDeletions({});
    } catch (error: any) {
      showToast(error?.message || 'Error occurred during batch submission.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Count totals
  const draftAddCount = Object.keys(draftAdditions).length;
  const draftDelCount = Object.keys(draftDeletions).length;
  const hasChanges = draftAddCount > 0 || draftDelCount > 0;

  // Ultra-compressed column dimensions to eliminate empty gaps and maximize visible dates & rows
  const FACULTY_COL_WIDTH = 135; // snug fit for faculty name and dept tag
  const SESSION_COL_WIDTH = 26;  // ultra-compact 26px for Morning and Afternoon
  const DATE_COL_WIDTH = SESSION_COL_WIDTH * 2; // 52px per day
  const totalTableWidth = FACULTY_COL_WIDTH + (dateList.length * DATE_COL_WIDTH);

  return (
    <div className="space-y-3.5">
      {/* Date Pickers and Filters Panel - compact inline bar */}
      <div className="bg-white rounded-xl border border-slate-150 p-3 sm:px-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title on the left */}
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="h-4 w-4 text-indigo-600 shrink-0" />
            <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm whitespace-nowrap">
              Roster Selection &amp; Filters
            </h3>
          </div>

          {/* Inline Controls beside title */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
            {/* From Date */}
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                From:
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1 px-2.5 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer shadow-2xs"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                To:
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1 px-2.5 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer shadow-2xs"
              />
            </div>

            {/* Search Faculty */}
            <div className="relative w-36 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1 pl-8 pr-2.5 text-xs font-bold text-slate-700 outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Department Filter */}
            <div className="min-w-[125px]">
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1 px-2.5 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer shadow-2xs"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'All' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Guards & Warnings */}
        {isRangeTooLarge && (
          <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold">Notice:</span> Date range exceeds 25 days. The calendar grid will automatically be truncated to the first 25 days to keep the layout highly readable and responsive.
            </div>
          </div>
        )}
      </div>

      {/* Grid Content Card */}
      <div 
        className={
          isFullScreen
            ? "fixed inset-0 z-50 bg-white flex flex-col h-screen w-screen overflow-hidden shadow-2xl animate-in fade-in duration-150"
            : "bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden flex flex-col"
        }
      >
        {/* Table header indicators */}
        <div className="p-2 sm:px-3 sm:py-2 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="text-[11px] font-bold text-slate-700">
                {filteredFaculties.length} Faculty Members ({dateList.length} Dates Loaded)
              </span>
            </div>

            {/* Quick search, department filter, and date pickers inside Full Screen header */}
            {isFullScreen && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-32 sm:w-44">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search faculty..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg py-1 pl-8 pr-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600 shadow-2xs"
                  />
                </div>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === 'All' ? 'All Depts' : dept}
                    </option>
                  ))}
                </select>

                {/* From Date beside All Depts */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">From:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
                  />
                </div>

                {/* To Date beside From Date */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">To:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
                  />
                </div>

                {isRangeTooLarge && (
                  <span 
                    title="Date range exceeds 25 days. The grid will automatically display the first 25 days." 
                    className="px-2 py-0.5 rounded bg-amber-100 border border-amber-250 text-amber-800 text-[10px] font-extrabold flex items-center gap-1 cursor-help shrink-0"
                  >
                    <AlertCircle className="h-3 w-3 text-amber-600" />
                    Max 25 Days
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Legend indicators */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-[8px] sm:text-[8.5px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded border border-slate-200 bg-white shadow-3xs"></span>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded border border-emerald-250 bg-emerald-50 shadow-3xs flex items-center justify-center text-[7px] text-emerald-700 font-black">✓</span>
              <span>Allotted</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded border border-indigo-300 bg-indigo-50 shadow-3xs flex items-center justify-center text-[6.5px] text-indigo-700 font-bold">+</span>
              <span>Draft Add</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded border border-red-300 bg-red-50 shadow-3xs flex items-center justify-center text-[6.5px] text-red-600 font-bold line-through">−</span>
              <span>Draft Delete</span>
            </div>

            {/* Small button beside Available, Allotted, Draft Add, Draft Delete */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border shadow-2xs active:scale-95 ${
                isFullScreen
                  ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-indigo-200 ring-2 ring-indigo-300'
                  : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-250 hover:border-indigo-300'
              }`}
              title={isFullScreen ? 'Exit Full Screen Mode (or press Esc)' : 'Expand table into full screen for maximum visibility of dates'}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="h-3 w-3 text-white shrink-0" />
                  <span className="hidden sm:inline">Exit Full Screen</span>
                  <span className="sm:hidden">Exit</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3 text-indigo-600 shrink-0" />
                  <span className="hidden sm:inline">Full Screen</span>
                  <span className="sm:hidden">Max</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Empty State check */}
        {dateList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Calendar className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No valid dates loaded in the current range.</p>
            <p className="text-[10px] text-slate-400 max-w-sm mx-auto">Please adjust the From Date and To Date pickers above to start scheduling duties.</p>
          </div>
        ) : (
          <>
            {/* Top synchronized scrollbar (only shown when table overflows container) */}
            {tableScrollRef.current && tableScrollWidth > tableScrollRef.current.clientWidth && (
              <div 
                ref={topScrollRef} 
                className="overflow-x-auto overflow-y-hidden border-b border-slate-150 bg-slate-50 h-[8px] sm:h-[10px] scrollbar-thin scrollbar-thumb-slate-300 shrink-0"
                style={{ scrollbarWidth: 'thin' }}
              >
                <div style={{ width: `${tableScrollWidth}px`, height: '1px' }}></div>
              </div>
            )}

            <div 
              className={`overflow-auto relative ${isFullScreen ? 'flex-1 min-h-0' : 'max-h-[70vh]'}`} 
              ref={tableScrollRef}
            >
              <table 
                ref={tableRef} 
                style={{ width: `${totalTableWidth}px`, minWidth: `${totalTableWidth}px` }} 
                className="text-left border-separate border-spacing-0 table-fixed"
              >
                {/* Table Column Sizes - compressed for maximum date visibility */}
                <colgroup>
                  {/* Faculty Name Column - tightly compressed to avoid any gap */}
                  <col style={{ width: `${FACULTY_COL_WIDTH}px`, minWidth: `${FACULTY_COL_WIDTH}px`, maxWidth: `${FACULTY_COL_WIDTH}px` }} />
                  {/* Date Columns (2 sub-cells per date: Morning & Afternoon) */}
                  {dateList.map(date => (
                    <React.Fragment key={date}>
                      <col style={{ width: `${SESSION_COL_WIDTH}px`, minWidth: `${SESSION_COL_WIDTH}px`, maxWidth: `${SESSION_COL_WIDTH}px` }} />
                      <col style={{ width: `${SESSION_COL_WIDTH}px`, minWidth: `${SESSION_COL_WIDTH}px`, maxWidth: `${SESSION_COL_WIDTH}px` }} />
                    </React.Fragment>
                  ))}
                </colgroup>

                <thead className="sticky top-0 z-30 bg-slate-50 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06)]">
                  {/* Date Headers - sticky top-0, vertically compact */}
                  <tr className="bg-slate-50 h-[26px]">
                    <th 
                      style={{ width: `${FACULTY_COL_WIDTH}px`, minWidth: `${FACULTY_COL_WIDTH}px`, maxWidth: `${FACULTY_COL_WIDTH}px` }}
                      className="sticky top-0 left-0 bg-slate-50 z-40 px-1.5 py-0.5 text-[8.5px] font-black text-slate-600 uppercase tracking-wider text-left border-r border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] leading-none h-[26px]"
                    >
                      Faculty Member
                    </th>
                    {dateList.map(date => {
                      const parts = getCompactDateParts(date);
                      return (
                        <th 
                          key={date} 
                          colSpan={2}
                          style={{ width: `${DATE_COL_WIDTH}px`, minWidth: `${DATE_COL_WIDTH}px`, maxWidth: `${DATE_COL_WIDTH}px` }}
                          title={`${parts.full} (${parts.weekday})`}
                          className="sticky top-0 z-30 px-0 py-0.5 text-center border-r border-b border-slate-200 bg-slate-50 select-none cursor-default h-[26px]"
                        >
                          <div className="flex flex-col items-center justify-center leading-none">
                            <div className="flex items-baseline gap-0.5 leading-none">
                              <span className="text-[10px] sm:text-[10.5px] font-black text-slate-800 tracking-tight">{parts.day}</span>
                              <span className="text-[6.5px] font-black text-indigo-600 uppercase">{parts.month}</span>
                            </div>
                            <span className="text-[6px] text-slate-400 font-bold uppercase leading-none mt-0.5">{parts.weekday}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                  {/* Session sub-headers - sticky top-[26px], vertically compact */}
                  <tr className="bg-slate-100 text-center h-[18px]">
                    <th 
                      style={{ width: `${FACULTY_COL_WIDTH}px`, minWidth: `${FACULTY_COL_WIDTH}px`, maxWidth: `${FACULTY_COL_WIDTH}px` }}
                      className="sticky top-[26px] left-0 bg-slate-100 z-40 px-1.5 py-0 border-r border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] text-[7px] font-black text-slate-500 uppercase text-left leading-none h-[18px]"
                    >
                      Session
                    </th>
                    {dateList.map(date => (
                      <React.Fragment key={date}>
                        <th 
                          style={{ width: `${SESSION_COL_WIDTH}px`, minWidth: `${SESSION_COL_WIDTH}px`, maxWidth: `${SESSION_COL_WIDTH}px` }}
                          title="Morning Session (MN)"
                          className="sticky top-[26px] z-30 py-0 px-0 text-[7px] font-black text-slate-500 uppercase border-r border-b border-slate-200 bg-slate-100 text-center select-none leading-none h-[18px]"
                        >
                          M
                        </th>
                        <th 
                          style={{ width: `${SESSION_COL_WIDTH}px`, minWidth: `${SESSION_COL_WIDTH}px`, maxWidth: `${SESSION_COL_WIDTH}px` }}
                          title="Afternoon Session (AF)"
                          className="sticky top-[26px] z-30 py-0 px-0 text-[7px] font-black text-slate-500 uppercase border-r border-b border-slate-200 bg-slate-100 text-center select-none leading-none h-[18px]"
                        >
                          A
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredFaculties.length === 0 ? (
                    <tr>
                      <td colSpan={1 + dateList.length * 2} className="px-6 py-6 text-center text-xs font-bold text-slate-400">
                        No matching faculty found.
                      </td>
                    </tr>
                  ) : (
                    filteredFaculties.map((fac, index) => {
                      const isEven = index % 2 === 0;
                      const rowBgClass = isEven ? 'bg-white' : 'bg-slate-50/70';
                      const stickyBgClass = isEven ? 'bg-white' : 'bg-slate-50';

                      return (
                        <tr key={fac.id} className={`${rowBgClass} transition-all border-b border-slate-200 h-[22px]`}>
                          {/* Faculty details (Sticky left column) - single row, snug fit, zero gap */}
                          <td 
                            style={{ width: `${FACULTY_COL_WIDTH}px`, minWidth: `${FACULTY_COL_WIDTH}px`, maxWidth: `${FACULTY_COL_WIDTH}px` }}
                            className={`sticky left-0 ${stickyBgClass} hover:bg-indigo-50/80 transition-colors z-10 px-1.5 py-0 border-r border-b border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] h-[22px]`}
                          >
                            <div className="flex items-center justify-between gap-1 w-full overflow-hidden leading-none">
                              <span className="text-[10px] font-bold text-slate-800 truncate" title={fac.name}>
                                {fac.name}
                              </span>
                              <span className="shrink-0 px-1 py-0.2 rounded bg-slate-200/80 border border-slate-300/80 text-[6.5px] font-black uppercase text-slate-600 leading-none">
                                {fac.department}
                              </span>
                            </div>
                          </td>

                        {/* Interactive columns for each date & session - 22px height */}
                        {dateList.map(date => {
                          const cellFN = getCellStatus(fac, date, 'Morning');
                          const cellAF = getCellStatus(fac, date, 'Afternoon');

                          return (
                            <React.Fragment key={date}>
                              {/* Morning cell */}
                              <td 
                                style={{ width: `${SESSION_COL_WIDTH}px`, minWidth: `${SESSION_COL_WIDTH}px`, maxWidth: `${SESSION_COL_WIDTH}px` }}
                                className="p-0 border-r border-b border-slate-200 h-[22px]"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(fac, date, 'Morning')}
                                  title={`${fac.name} - ${formatDisplayDate(date)} (Morning): ${cellFN.tooltip}`}
                                  className={`w-full h-[22px] flex items-center justify-center transition-all outline-none border border-transparent select-none font-bold cursor-pointer ${cellFN.className}`}
                                >
                                  {cellFN.type === 'allocated' && <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3px]" />}
                                  {cellFN.type === 'delete-pending' && <span className="font-black text-red-600 text-[8px] leading-none">✕</span>}
                                  {cellFN.type === 'add-pending' && <span className="font-black text-indigo-700 text-[8px] leading-none animate-pulse">+</span>}
                                </button>
                              </td>

                              {/* Afternoon cell */}
                              <td 
                                style={{ width: `${SESSION_COL_WIDTH}px`, minWidth: `${SESSION_COL_WIDTH}px`, maxWidth: `${SESSION_COL_WIDTH}px` }}
                                className="p-0 border-r border-b border-slate-200 h-[22px]"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(fac, date, 'Afternoon')}
                                  title={`${fac.name} - ${formatDisplayDate(date)} (Afternoon): ${cellAF.tooltip}`}
                                  className={`w-full h-[22px] flex items-center justify-center transition-all outline-none border border-transparent select-none font-bold cursor-pointer ${cellAF.className}`}
                                >
                                  {cellAF.type === 'allocated' && <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3px]" />}
                                  {cellAF.type === 'delete-pending' && <span className="font-black text-red-600 text-[8px] leading-none">✕</span>}
                                  {cellAF.type === 'add-pending' && <span className="font-black text-indigo-700 text-[8px] leading-none animate-pulse">+</span>}
                                </button>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

        {/* Sticky Control Bar / Submission Ledger */}
        <div className="bg-slate-50 border-t border-slate-150 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="font-extrabold text-slate-800">Pending Changes:</span>
            {hasChanges ? (
              <div className="flex items-center gap-2">
                {draftAddCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-black text-[10px] uppercase">
                    <Plus className="h-3 w-3" /> {draftAddCount} To Allocate
                  </span>
                )}
                {draftDelCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 font-black text-[10px] uppercase">
                    <Trash2 className="h-3 w-3" /> {draftDelCount} To Remove
                  </span>
                )}
              </div>
            ) : (
              <span className="font-medium text-slate-400 italic">No cell edits made yet. Select cells to queue roster additions/deletions.</span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            {hasChanges && (
              <button
                type="button"
                onClick={handleResetDrafts}
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 border border-slate-250 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Selections</span>
              </button>
            )}

            {!isAdmin ? (
              <button
                type="button"
                onClick={onLoginClick}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
              >
                <span>Authorize to Save Duties</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitAllocations}
                disabled={!hasChanges || isSubmitting}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black transition-all shadow-md ${
                  hasChanges && !isSubmitting
                    ? 'bg-blue-900 hover:bg-blue-955 text-white cursor-pointer active:scale-95'
                    : 'bg-slate-200 text-slate-450 border border-slate-250 cursor-not-allowed opacity-75'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Submitting Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    <span>Submit {draftAddCount + draftDelCount} Changes</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
