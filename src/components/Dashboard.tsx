import React from 'react';
import { Users, Calendar, Award } from 'lucide-react';
import { ExamAllocation } from '../types';
import { isToday } from '../utils';

interface DashboardProps {
  allocations: ExamAllocation[];
}

export function Dashboard({ allocations }: DashboardProps) {
  // Aggregate stats
  const uniqueFaculty = new Set(allocations.map(a => a.facultyName.toLowerCase().trim()));
  const totalFacultyCount = uniqueFaculty.size;

  const todayCount = allocations.filter(a => isToday(a.date)).length;

  const totalAllocations = allocations.length;

  const uniqueDepts = new Set(allocations.map(a => a.department));
  const deptsCount = uniqueDepts.size;

  const stats = [
    {
      title: 'Total Faculty',
      value: totalFacultyCount,
      icon: <Users className="h-5 w-5 text-blue-900" />,
      borderClass: 'border-l-4 border-blue-900',
      tag: 'Unique teachers allocated',
    },
    {
      title: "Today's Duties",
      value: todayCount,
      icon: <Calendar className="h-5 w-5 text-orange-500" />,
      borderClass: 'border-l-4 border-orange-500',
      tag: 'Duties scheduled for today',
    },
    {
      title: 'Total Allocations',
      value: totalAllocations,
      icon: <Award className="h-5 w-5 text-blue-900" />,
      borderClass: 'border-l-4 border-blue-900',
      tag: 'Completed & upcoming entries',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className={`bg-white rounded-xl shadow-sm ${stat.borderClass} p-5 border-y border-r border-slate-200/60 hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5 flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {stat.title}
            </span>
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
              {stat.icon}
            </div>
          </div>
          
          <div className="flex flex-col mt-2">
            <span className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {stat.value}
            </span>
            <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">
              {stat.tag}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
