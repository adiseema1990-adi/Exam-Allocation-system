import React from 'react';
import { Users, Calendar, Award, ChevronRight } from 'lucide-react';
import { ExamAllocation } from '../types';
import { isToday } from '../utils';

interface DashboardProps {
  allocations: ExamAllocation[];
  onTodayDutiesClick?: () => void;
  onSelectedDateDutiesClick?: (date: string) => void;
}

export function Dashboard({ allocations, onTodayDutiesClick, onSelectedDateDutiesClick }: DashboardProps) {
  // Aggregate stats
  const uniqueFaculty = new Set(allocations.map(a => a.facultyName.toLowerCase().trim()));
  const totalFacultyCount = uniqueFaculty.size;

  const todayCount = allocations.filter(a => isToday(a.date)).length;

  const totalAllocations = allocations.length;

  const isInteractive = !!onTodayDutiesClick;

  // Selected date state inside Dashboard
  const [selectedDate, setSelectedDate] = React.useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const selectedDateCount = allocations.filter(a => a.date === selectedDate).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-4xl">
      {/* 1. Today's Duties: Compact card */}
      <div
        onClick={isInteractive ? onTodayDutiesClick : undefined}
        className={`bg-orange-200 border border-orange-350 border-l-4 border-l-orange-600 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all duration-300 min-h-[68px] sm:min-h-[72px] select-none ${
          isInteractive 
            ? 'cursor-pointer hover:bg-orange-300/90 hover:border-orange-450 active:scale-[0.98]' 
            : ''
        }`}
      >
        <div className="flex items-start justify-between gap-1 overflow-hidden">
          <span className="text-[9px] sm:text-[10px] font-black text-orange-950 uppercase tracking-wider truncate">
            Today's Duties
          </span>
          <div className="flex flex-col items-end shrink-0">
            <div className="p-1 bg-white/95 rounded-md border border-orange-300 text-orange-700 shrink-0">
              <Calendar className="h-3.5 w-3.5" />
            </div>
            <span className="text-[7px] sm:text-[8px] font-black text-orange-900 uppercase tracking-wider mt-1.5 animate-pulse select-none">
              Click to view
            </span>
          </div>
        </div>
        
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base sm:text-lg font-black text-orange-950 tracking-tight">
            {todayCount}
          </span>
          <span className="text-[8px] text-orange-900 font-extrabold uppercase tracking-wider truncate hidden sm:inline">
            Active
          </span>
        </div>
      </div>

      {/* 2. Total Faculty: Compact card */}
      <div className="bg-blue-50/90 rounded-xl shadow-xs border border-blue-200/80 border-l-4 border-l-blue-900 p-2.5 sm:p-3 flex flex-col justify-between min-h-[68px] sm:min-h-[72px] hover:bg-blue-100/60 hover:border-blue-250 transition-all duration-300">
        <div className="flex items-center justify-between gap-1 overflow-hidden">
          <span className="text-[9px] sm:text-[10px] font-black text-blue-950 uppercase tracking-wider truncate">
            Total Faculty
          </span>
          <div className="p-1 bg-white/95 rounded-md border border-blue-200 text-blue-900 shrink-0">
            <Users className="h-3.5 w-3.5 text-blue-900" />
          </div>
        </div>
        
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base sm:text-lg font-black text-blue-950 tracking-tight">
            {totalFacultyCount}
          </span>
          <span className="text-[8px] text-blue-800 font-bold uppercase tracking-wider truncate hidden sm:inline">
            Uniques
          </span>
        </div>
      </div>

      {/* 3. Total Allocations: Compact card (light crimson red style) */}
      <div className="bg-rose-50/90 rounded-xl shadow-xs border border-rose-200/80 border-l-4 border-l-rose-600 p-2.5 sm:p-3 flex flex-col justify-between min-h-[68px] sm:min-h-[72px] hover:bg-rose-100/60 hover:border-rose-250 transition-all duration-300">
        <div className="flex items-center justify-between gap-1 overflow-hidden">
          <span className="text-[9px] sm:text-[10px] font-black text-rose-950 uppercase tracking-wider truncate">
            Total Allocations
          </span>
          <div className="p-1 bg-white/95 rounded-md border border-rose-200 text-rose-600 shrink-0">
            <Award className="h-3.5 w-3.5" />
          </div>
        </div>
        
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-base sm:text-lg font-black text-rose-950 tracking-tight">
            {totalAllocations}
          </span>
          <span className="text-[8px] text-rose-800 font-bold uppercase tracking-wider truncate hidden sm:inline">
            Duties
          </span>
        </div>
      </div>

      {/* 4. Select Date Duties: Compact card */}
      <div className="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-600 rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-300 min-h-[68px] sm:min-h-[72px] select-none hover:bg-emerald-100 hover:border-emerald-300">
        <div className="flex items-start justify-between gap-1 overflow-hidden">
          <span className="text-[9px] sm:text-[10px] font-black text-emerald-950 uppercase tracking-wider truncate">
            Select Date Duties
          </span>
          <div className="flex flex-col items-end shrink-0">
            <button
              type="button"
              onClick={() => {
                if (selectedDate && onSelectedDateDutiesClick) {
                  onSelectedDateDutiesClick(selectedDate);
                }
              }}
              disabled={!selectedDate}
              className="p-1 bg-white/95 hover:bg-emerald-50 disabled:bg-slate-100 disabled:text-slate-300 rounded-md border border-emerald-200 disabled:border-slate-150 text-emerald-700 shrink-0 cursor-pointer disabled:cursor-not-allowed hover:scale-105 active:scale-95 disabled:scale-100 transition-all"
              title="View duties for selected date"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <span className="text-[7px] sm:text-[8px] font-black text-emerald-900 uppercase tracking-wider mt-1 select-none">
              {selectedDateCount} Active
            </span>
          </div>
        </div>
        
        <div className="mt-1 flex items-center justify-between gap-1.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] sm:text-xs text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full cursor-pointer h-7"
          />
        </div>
      </div>
    </div>
  );
}
