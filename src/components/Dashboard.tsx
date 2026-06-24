import React from 'react';
import { Users, Calendar, Award } from 'lucide-react';
import { ExamAllocation } from '../types';
import { isToday } from '../utils';

interface DashboardProps {
  allocations: ExamAllocation[];
  onTodayDutiesClick?: () => void;
}

export function Dashboard({ allocations, onTodayDutiesClick }: DashboardProps) {
  // Aggregate stats
  const uniqueFaculty = new Set(allocations.map(a => a.facultyName.toLowerCase().trim()));
  const totalFacultyCount = uniqueFaculty.size;

  const todayCount = allocations.filter(a => isToday(a.date)).length;

  const totalAllocations = allocations.length;

  const isInteractive = !!onTodayDutiesClick;

  return (
    <div className="grid grid-cols-3 gap-3 mb-6 max-w-3xl">
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
    </div>
  );
}
