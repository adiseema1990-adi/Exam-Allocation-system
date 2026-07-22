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
  AlertCircle
} from 'lucide-react';
import { ExamAllocation, Faculty, Department, Session } from '../types';
import { formatDisplayDate, findFaculty } from '../utils';

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
    
    // Limit to 14 days to prevent UI overload
    let count = 0;
    while (current <= end && count < 14) {
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
    return diffDays > 14;
  }, [fromDate, toDate]);

  // Index allocations for super fast lookup
  // Map: facultyName (lowercase) -> date -> session -> ExamAllocation
  const allocationLookup = useMemo(() => {
    const lookup: Record<string, Record<string, Record<string, ExamAllocation>>> = {};
    allocations.forEach(alloc => {
      const nameKey = alloc.facultyName.trim().toLowerCase();
      if (!lookup[nameKey]) {
        lookup[nameKey] = {};
      }
      if (!lookup[nameKey][alloc.date]) {
        lookup[nameKey][alloc.date] = {};
      }
      
      // Map both Morning/Afternoon or handle normal sessions
      if (alloc.session === 'Morning' || alloc.session === 'Afternoon') {
        lookup[nameKey][alloc.date][alloc.session] = alloc;
      } else if (alloc.session === 'Full Day') {
        // If assigned for full day, block both Morning and Afternoon
        lookup[nameKey][alloc.date]['Morning'] = alloc;
        lookup[nameKey][alloc.date]['Afternoon'] = alloc;
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

  return (
    <div className="space-y-6">
      {/* Date Pickers and Filters Panel */}
      <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-sm space-y-4">
        {/* Title row */}
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Filter className="h-4.5 w-4.5 text-indigo-600" />
          <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm">Roster Selection &amp; Filters</h3>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Dates selectors - 5 cols */}
          <div className="md:col-span-6 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">From Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">To Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Search Faculty - 4 cols */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search Faculty</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-700 outline-none transition-all"
              />
            </div>
          </div>

          {/* Department Filter - 3 cols */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? 'All Departments' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Guards & Warnings */}
        {isRangeTooLarge && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold">Notice:</span> Date range exceeds 14 days. The calendar grid will automatically be truncated to the first 14 days to keep the layout highly readable and responsive.
            </div>
          </div>
        )}
      </div>

      {/* Grid Content Card */}
      <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden flex flex-col">
        {/* Table header indicators */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-slate-400" />
            <span className="text-xs font-black text-slate-700">
              Showing {filteredFaculties.length} Faculty Members ({dateList.length} Dates Loaded)
            </span>
          </div>

          {/* Legend indicators */}
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-md border border-slate-200 bg-white shadow-3xs"></span>
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-md border border-emerald-250 bg-emerald-50 shadow-3xs flex items-center justify-center text-[8px] text-emerald-700">✓</span>
              <span>Allocated</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-md border border-indigo-300 bg-indigo-50 shadow-3xs flex items-center justify-center text-[7px] text-indigo-700 font-bold">+</span>
              <span>Draft Add</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-4 rounded-md border border-red-300 bg-red-50 shadow-3xs flex items-center justify-center text-[7px] text-red-600 font-bold line-through">−</span>
              <span>Draft Delete</span>
            </div>
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
            {/* Top synchronized scrollbar */}
            {tableScrollWidth > 0 && (
              <div 
                ref={topScrollRef} 
                className="overflow-x-auto overflow-y-hidden border-b border-slate-150 bg-slate-50 h-[8px] sm:h-[10px] scrollbar-thin scrollbar-thumb-slate-300"
                style={{ scrollbarWidth: 'thin' }}
              >
                <div style={{ width: `${tableScrollWidth}px`, height: '1px' }}></div>
              </div>
            )}

            <div className="overflow-x-auto relative" ref={tableScrollRef}>
              <table ref={tableRef} className="w-full text-left border-collapse table-fixed min-w-[700px]">
                {/* Table Column Sizes */}
                <colgroup>
                  {/* Faculty Name Column - tighter fit */}
                  <col className="w-[120px] sm:w-[150px]" />
                  {/* Date Columns (2 sub-cells per date) */}
                  {dateList.map(date => (
                    <React.Fragment key={date}>
                      <col className="w-[50px] sm:w-[60px]" />
                      <col className="w-[50px] sm:w-[60px]" />
                    </React.Fragment>
                  ))}
                </colgroup>

                <thead>
                  {/* Date Headers */}
                  <tr className="bg-slate-50 border-b border-slate-150">
                    <th className="sticky left-0 bg-slate-50 z-20 px-2.5 py-2.5 text-[9.5px] font-black text-slate-500 uppercase tracking-wider text-left border-r border-slate-150 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      Faculty Member
                    </th>
                    {dateList.map(date => (
                      <th 
                        key={date} 
                        colSpan={2}
                        className="px-2 py-3 text-[10.5px] font-black text-slate-700 uppercase tracking-wide text-center border-r border-slate-150"
                      >
                        <div className="flex flex-col items-center">
                          <span>{formatDisplayDate(date)}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                  {/* Session sub-headers */}
                  <tr className="bg-slate-100/60 border-b border-slate-150 text-center">
                    <th className="sticky left-0 bg-slate-50 z-20 px-2.5 py-1.5 border-r border-slate-150 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      {/* Placeholder */}
                    </th>
                    {dateList.map(date => (
                      <React.Fragment key={date}>
                        <th className="py-1 px-1 text-[9px] font-black text-slate-500 uppercase tracking-wider border-r border-slate-150/50 bg-slate-100/50">
                          MN
                        </th>
                        <th className="py-1 px-1 text-[9px] font-black text-slate-500 uppercase tracking-wider border-r border-slate-150 bg-slate-100/50">
                          AF
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredFaculties.length === 0 ? (
                    <tr>
                      <td colSpan={1 + dateList.length * 2} className="px-6 py-10 text-center text-xs font-bold text-slate-400">
                        No matching faculty found.
                      </td>
                    </tr>
                  ) : (
                    filteredFaculties.map((fac, index) => {
                      const isEven = index % 2 === 0;
                      const rowBgClass = isEven ? 'bg-white' : 'bg-slate-100/70';
                      const stickyBgClass = isEven ? 'bg-white' : 'bg-slate-100';

                      return (
                        <tr key={fac.id} className={`${rowBgClass} transition-all border-b border-slate-300`}>
                          {/* Faculty details (Sticky left column) - tightened fit */}
                          <td className={`sticky left-0 ${stickyBgClass} hover:bg-indigo-50/80 transition-colors z-10 px-2.5 py-1.5 border-r border-b border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]`}>
                            <div className="flex flex-col min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate" title={fac.name}>
                                {fac.name}
                              </div>
                              <div className="mt-0.5">
                                <span className="inline-block px-1.5 py-0.2 rounded bg-slate-200 border border-slate-300 text-[7.5px] font-black uppercase text-slate-700 leading-none">
                                  {fac.department}
                                </span>
                              </div>
                            </div>
                          </td>

                        {/* Interactive columns for each date & session */}
                        {dateList.map(date => {
                          const cellFN = getCellStatus(fac, date, 'Morning');
                          const cellAF = getCellStatus(fac, date, 'Afternoon');

                          return (
                            <React.Fragment key={date}>
                              {/* Morning cell */}
                              <td className="p-0 border-r border-b border-slate-300">
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(fac, date, 'Morning')}
                                  title={`${fac.name} - ${formatDisplayDate(date)} (Morning): ${cellFN.tooltip}`}
                                  className={`w-full h-10 flex flex-col items-center justify-center text-[9px] transition-all outline-none border border-transparent select-none font-bold ${cellFN.className}`}
                                >
                                  {cellFN.type === 'allocated' && <Check className="h-3 w-3 text-emerald-600 stroke-[3px]" />}
                                  {cellFN.type === 'delete-pending' && <span className="font-extrabold text-red-600">REM</span>}
                                  {cellFN.type === 'add-pending' && <span className="font-extrabold text-indigo-700 animate-pulse">+ADD</span>}
                                </button>
                              </td>

                              {/* Afternoon cell */}
                              <td className="p-0 border-r border-b border-slate-300">
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(fac, date, 'Afternoon')}
                                  title={`${fac.name} - ${formatDisplayDate(date)} (Afternoon): ${cellAF.tooltip}`}
                                  className={`w-full h-10 flex flex-col items-center justify-center text-[9px] transition-all outline-none border border-transparent select-none font-bold ${cellAF.className}`}
                                >
                                  {cellAF.type === 'allocated' && <Check className="h-3 w-3 text-emerald-600 stroke-[3px]" />}
                                  {cellAF.type === 'delete-pending' && <span className="font-extrabold text-red-600">REM</span>}
                                  {cellAF.type === 'add-pending' && <span className="font-extrabold text-indigo-700 animate-pulse">+ADD</span>}
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
