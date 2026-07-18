import React, { useState } from 'react';
import { 
  Users, 
  Calendar, 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  UserCheck, 
  TrendingUp, 
  AlertCircle, 
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import { ExamAllocation, Faculty, Department } from '../types';
import { formatDisplayDate } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FacultyDutySummaryProps {
  allocations: ExamAllocation[];
  faculties: Faculty[];
  isAdmin: boolean;
  onLoginClick: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function FacultyDutySummary({
  allocations,
  faculties,
  isAdmin,
  onLoginClick,
  showToast
}: FacultyDutySummaryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'duties-desc' | 'duties-asc'>('duties-desc');
  const [expandedFaculty, setExpandedFaculty] = useState<Record<string, boolean>>({});
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Departments list for dropdown filter
  const departments: (Department | 'All')[] = [
    'All', 'CSE', 'ECE', 'Mechanical', 'Civil', 'AIML', 'MBA', 
    'Mathematics', 'Physics', 'Chemistry', 'Humanities', 'Others'
  ];

  // Filter allocations by date range if specified (inclusive)
  const dateFilteredAllocations = allocations.filter(alloc => {
    if (fromDate && alloc.date < fromDate) return false;
    if (toDate && alloc.date > toDate) return false;
    return true;
  });

  // Group allocations by faculty
  const facultyGroupMap: Record<string, { 
    facultyName: string; 
    department: string; 
    phone: string;
    duties: ExamAllocation[]; 
  }> = {};

  // Initialize with all registered faculties to ensure complete coverage, even if they have 0 duties
  faculties.forEach(f => {
    facultyGroupMap[f.name.trim().toLowerCase()] = {
      facultyName: f.name,
      department: f.department,
      phone: f.phone || '',
      duties: []
    };
  });

  // Populate duties from filtered allocations
  dateFilteredAllocations.forEach(alloc => {
    const key = alloc.facultyName.trim().toLowerCase();
    if (!facultyGroupMap[key]) {
      // If a faculty is in allocations but not registered in registry
      facultyGroupMap[key] = {
        facultyName: alloc.facultyName,
        department: alloc.department || 'Others',
        phone: '',
        duties: []
      };
    }
    facultyGroupMap[key].duties.push(alloc);
  });

  // Convert to array
  const facultySummaries = Object.values(facultyGroupMap);

  // Apply filters
  const filteredSummaries = facultySummaries.filter(item => {
    // Search query filter (faculty name, department or phone)
    const matchesSearch = searchQuery.trim() === '' || 
      item.facultyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.phone.includes(searchQuery);

    // Department filter
    const matchesDept = selectedDept === 'All' || item.department === selectedDept;

    // Date range filter: if active, only show faculty who actually have at least 1 duty within that range
    const matchesDateRange = (!fromDate && !toDate) || item.duties.length > 0;

    return matchesSearch && matchesDept && matchesDateRange;
  });

  // Sort summaries
  const sortedSummaries = [...filteredSummaries].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return a.facultyName.localeCompare(b.facultyName);
    } else if (sortBy === 'name-desc') {
      return b.facultyName.localeCompare(a.facultyName);
    } else if (sortBy === 'duties-desc') {
      return b.duties.length - a.duties.length || a.facultyName.localeCompare(b.facultyName);
    } else {
      return a.duties.length - b.duties.length || a.facultyName.localeCompare(b.facultyName);
    }
  });

  // Global calculations based on filtered allocations
  const totalAllocationsCount = dateFilteredAllocations.length;
  const totalAdjustedCount = dateFilteredAllocations.filter(a => a.isAdjusted).length;
  const totalRegisteredCount = faculties.length;
  
  // Calculate average duties per registered faculty
  const averageDuties = totalRegisteredCount > 0 
    ? (totalAllocationsCount / totalRegisteredCount).toFixed(1) 
    : '0';

  // Find most loaded faculty
  const mostLoaded = facultySummaries.reduce((max, current) => {
    return current.duties.length > max.duties.length ? current : max;
  }, { facultyName: 'None', duties: [] as ExamAllocation[] });

  const toggleExpand = (facultyName: string) => {
    setExpandedFaculty(prev => ({
      ...prev,
      [facultyName]: !prev[facultyName]
    }));
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Page title
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('Faculty-wise Examination Duty Summary Report', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 26);
      let subtitle = `Total Registered Faculty: ${totalRegisteredCount} | Total Allocated Duties: ${totalAllocationsCount}`;
      if (fromDate || toDate) {
        const rangeText = `${fromDate ? formatDisplayDate(fromDate) : 'Start'} to ${toDate ? formatDisplayDate(toDate) : 'End'}`;
        subtitle += ` | Date Range: ${rangeText}`;
      }
      doc.text(subtitle, 14, 31);
      
      // Table columns
      const tableColumn = ['S.No', 'Faculty Name', 'Department', 'Phone Number', 'Total Duties', 'Details of Duties (Date & Session)'];
      
      // Table rows
      const tableRows: any[] = [];
      sortedSummaries.forEach((fac, index) => {
        // Sort individual duties by date chronological
        const sortedDuties = [...fac.duties].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const dutiesDetailString = sortedDuties.map(d => {
          return `${formatDisplayDate(d.date)} (${d.session})${d.isAdjusted ? ' [Adjusted]' : ''}`;
        }).join('\n');

        tableRows.push([
          index + 1,
          fac.facultyName,
          fac.department,
          fac.phone || 'N/A',
          fac.duties.length,
          dutiesDetailString || 'No duties assigned till date'
        ]);
      });

      // Render table
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 38,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], halign: 'left', fontSize: 9 },
        bodyStyles: { fontSize: 8, valign: 'top' },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 35 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 70 }
        },
        styles: { overflow: 'linebreak', cellPadding: 3 }
      });

      // Save document
      doc.save(`Faculty_Duty_Summary_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('Faculty duty summary PDF report exported successfully!', 'success');
    } catch (err: any) {
      showToast('Failed to export PDF report.', 'error');
      console.error(err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm space-y-6 my-10 animate-fadeIn">
        <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-full">
          <ShieldAlert className="h-8 w-8 text-indigo-600 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-extrabold text-slate-800">
            Administrative Access Restricted
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            The master faculty-wise duty report holds secure exam duty allocation summaries. Please log in using administrative credentials to access this summary.
          </p>
        </div>
        <button
          onClick={onLoginClick}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
        >
          <UserCheck className="h-4 w-4" />
          <span>Log In as Admin</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* Title Header & Export Option */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-850">
            Faculty-wise Master Duty Ledger
          </h2>
          <p className="text-xs text-slate-500 font-semibold">
            Consolidated real-time register of total duty counts assigned to registered faculty. Monitor workloads, analyze emergency shifts, and generate reports.
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer border border-red-500/20"
        >
          <Download className="h-4.5 w-4.5" />
          <span>EXPORT MASTER PDF</span>
        </button>
      </div>

      {/* KPI Stats Dashboard Section */}
      <div className="grid grid-cols-4 gap-1 sm:gap-3">
        {/* Metric Card 1 */}
        <div className="bg-white border border-slate-150 rounded-lg p-1 sm:p-2.5 shadow-sm flex flex-col min-[550px]:flex-row items-center gap-1 sm:gap-3 text-center min-[550px]:text-left">
          <div className="p-1 sm:p-2 bg-indigo-50 text-indigo-600 rounded-md shrink-0">
            <Users className="h-3 w-3 sm:h-4.5 sm:w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[7.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-tight">Total Registered</div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-800 leading-tight mt-0.5">
              {totalRegisteredCount} <span className="hidden min-[400px]:inline">Faculty</span>
            </div>
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-white border border-slate-150 rounded-lg p-1 sm:p-2.5 shadow-sm flex flex-col min-[550px]:flex-row items-center gap-1 sm:gap-3 text-center min-[550px]:text-left">
          <div className="p-1 sm:p-2 bg-emerald-50 text-emerald-600 rounded-md shrink-0">
            <Calendar className="h-3 w-3 sm:h-4.5 sm:w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[7.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-tight">Total Duties</div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-800 leading-tight mt-0.5">
              {totalAllocationsCount} <span className="hidden min-[400px]:inline">Duties</span>
            </div>
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-white border border-slate-150 rounded-lg p-1 sm:p-2.5 shadow-sm flex flex-col min-[550px]:flex-row items-center gap-1 sm:gap-3 text-center min-[550px]:text-left">
          <div className="p-1 sm:p-2 bg-amber-50 text-amber-600 rounded-md shrink-0">
            <TrendingUp className="h-3 w-3 sm:h-4.5 sm:w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[7.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-tight">Avg Workload</div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-800 leading-tight mt-0.5">
              {averageDuties} <span className="hidden min-[450px]:inline">Duties</span>
            </div>
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className="bg-white border border-slate-150 rounded-lg p-1 sm:p-2.5 shadow-sm flex flex-col min-[550px]:flex-row items-center gap-1 sm:gap-3 text-center min-[550px]:text-left">
          <div className="p-1 sm:p-2 bg-rose-50 text-rose-600 rounded-md shrink-0">
            <AlertCircle className="h-3 w-3 sm:h-4.5 sm:w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[7.5px] sm:text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-tight">Adjusted</div>
            <div className="text-[10px] sm:text-xs font-medium text-slate-800 leading-tight mt-0.5">
              {totalAdjustedCount} <span className="hidden min-[400px]:inline">Duties</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Customizers Section */}
      <div className="bg-white rounded-xl border border-slate-150 p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4.5 w-4.5 text-indigo-600" />
            <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm">Filter &amp; Sort Control</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:max-w-3xl shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1.5 px-3 pl-9 text-xs font-semibold text-slate-750 outline-none transition-all"
              />
            </div>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1.5 px-3 text-xs font-bold text-slate-750 outline-none cursor-pointer transition-all"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? 'All Departments' : `${dept} Dept`}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1.5 px-3 text-xs font-bold text-slate-750 outline-none cursor-pointer transition-all"
            >
              <option value="duties-desc">Duties Count (Highest First)</option>
              <option value="duties-asc">Duties Count (Lowest First)</option>
              <option value="name-asc">Faculty Name (A-Z)</option>
              <option value="name-desc">Faculty Name (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Date Filter Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between w-full sm:w-auto gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-indigo-600" />
              <span>Search by Date Range (inclusive):</span>
            </div>
            
            {/* Always visible and highly styled Clear Range Button */}
            <button
              disabled={!fromDate && !toDate}
              onClick={() => {
                setFromDate('');
                setToDate('');
                showToast('Date range filters cleared', 'info');
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-all border shadow-xs ${
                fromDate || toDate
                  ? 'bg-rose-50 hover:bg-rose-100 border-rose-250 text-rose-600 cursor-pointer active:scale-95'
                  : 'bg-slate-50 border-slate-200 text-slate-350 cursor-not-allowed opacity-50'
              }`}
            >
              Clear Range
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-nowrap items-center gap-3 w-full sm:w-auto">
            {/* From Date */}
            <div className="flex items-center gap-1 sm:gap-1.5 relative">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From:</span>
              <div className="relative flex-grow flex items-center">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1 px-1.5 sm:px-2.5 pr-6 sm:pr-7 text-[11px] sm:text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer w-full"
                />
                {fromDate && (
                  <button
                    onClick={() => setFromDate('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear from date"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1 sm:gap-1.5 relative">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To:</span>
              <div className="relative flex-grow flex items-center">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 focus:border-indigo-600 focus:bg-white rounded-lg py-1 px-1.5 sm:px-2.5 pr-6 sm:pr-7 text-[11px] sm:text-xs font-bold text-slate-700 outline-none transition-all cursor-pointer w-full"
                />
                {toDate && (
                  <button
                    onClick={() => setToDate('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-extrabold text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear to date"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Aggregations Ledger */}
      <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden">
        <div className="py-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-600 rounded"></span>
            <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">Workload Ledger</h4>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Showing {sortedSummaries.length} faculty members
          </span>
        </div>

        {sortedSummaries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold space-y-2">
            <p className="text-sm">No matching faculty summaries found.</p>
            <p className="text-xs font-medium text-slate-400">Try loosening your search query or department filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedSummaries.map((fac, idx) => {
              const isExpanded = !!expandedFaculty[fac.facultyName];
              const totalDuties = fac.duties.length;
              const hasAdjusted = fac.duties.some(d => d.isAdjusted);
              
              return (
                <div key={fac.facultyName} className="p-4 sm:p-5 hover:bg-slate-50/40 transition-colors duration-150">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="text-xs font-extrabold text-slate-300 text-center w-5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h5 className="font-extrabold text-slate-800 text-sm sm:text-base leading-none">
                            {fac.facultyName}
                          </h5>
                          <span className="inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 border border-indigo-150 text-indigo-700 uppercase">
                            {fac.department}
                          </span>
                          {hasAdjusted && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-md text-[8px] font-black bg-rose-50 border border-rose-150 text-rose-600 uppercase">
                              Has Emergency Shunts
                            </span>
                          )}
                        </div>
                        {fac.phone && (
                          <p className="text-[10px] sm:text-xs text-slate-400 font-semibold">
                            Phone: {fac.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-black rounded-lg ${
                          totalDuties > 4 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : totalDuties > 0 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {totalDuties} {totalDuties === 1 ? 'Duty' : 'Duties'}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleExpand(fac.facultyName)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 transition-all cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-700" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-700" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detailed Duties list */}
                  {isExpanded && (
                    <div className="mt-4 pl-8 pr-2 pt-4 border-t border-dashed border-slate-150 space-y-3 animate-fadeIn">
                      <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                        <Bookmark className="h-3 w-3 text-indigo-500" />
                        Allocated Schedules History
                      </div>

                      {totalDuties === 0 ? (
                        <div className="p-3 bg-slate-50 border border-slate-150 text-slate-400 font-bold text-xs rounded-xl">
                          No duties are registered for this faculty member.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {[...fac.duties]
                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            .map(duty => (
                              <div 
                                key={duty.id} 
                                className={`py-1.5 px-3 rounded-lg border flex flex-col justify-center gap-1 relative overflow-hidden shrink-0 ${
                                  duty.isAdjusted 
                                    ? 'bg-red-50/50 border-red-200 text-red-950 min-w-[140px] max-w-[200px]' 
                                    : 'bg-white border-slate-200 text-slate-800 min-w-[100px]'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="text-[11px] font-black leading-tight">
                                    {formatDisplayDate(duty.date)}
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-500 flex items-center">
                                    <span className={`inline-flex px-1.5 py-0.2 rounded-full text-[7.5px] font-black uppercase ${
                                      duty.session === 'Forenoon' 
                                        ? 'bg-orange-100 text-orange-700' 
                                        : 'bg-purple-100 text-purple-700'
                                    }`}>
                                      {duty.session}
                                    </span>
                                  </div>
                                </div>

                                {duty.isAdjusted && (
                                  <div className="mt-0.5 pt-0.5 border-t border-red-100">
                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-black bg-red-150 text-red-700 border border-red-200 uppercase tracking-wide">
                                      Adjusted
                                    </span>
                                    {duty.adjustedFrom && (
                                      <p className="text-[8.5px] text-red-700 font-medium mt-0.5 leading-tight">
                                        From: <strong className="font-extrabold">{duty.adjustedFrom}</strong>
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
