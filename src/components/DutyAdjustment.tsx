import React, { useState, useMemo } from 'react';
import { Calendar, Clock, RefreshCw, UserCheck, AlertCircle, ArrowRight, ShieldAlert, CheckCircle } from 'lucide-react';
import { ExamAllocation, Faculty, Session } from '../types';
import { formatDisplayDate, findFaculty, normalizeDateToISO, isSameDate, normalizeSession, matchesSession } from '../utils';

interface DutyAdjustmentProps {
  allocations: ExamAllocation[];
  faculties: Faculty[];
  isAdmin: boolean;
  onUpdateAllocation: (id: string, record: Omit<ExamAllocation, 'id' | 'createdAt'>) => Promise<boolean>;
  onLoginClick: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function DutyAdjustment({
  allocations,
  faculties,
  isAdmin,
  onUpdateAllocation,
  onLoginClick,
  showToast
}: DutyAdjustmentProps) {
  // 1. Select Date and Session
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayISO = `${year}-${month}-${day}`;
    return todayISO;
  });
  const [selectedSession, setSelectedSession] = useState<Session>('Morning');

  // 2. Select Source and Destination Allocation/Faculty
  const [selectedAllocationId, setSelectedAllocationId] = useState<string>('');
  const [targetFacultyId, setTargetFacultyId] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Emergency medical leave');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Normalized selected date in ISO format (YYYY-MM-DD)
  const normalizedSelectedDate = normalizeDateToISO(selectedDate);

  // Filter allocations matching selected date and session with robust date and session normalization
  const activeAllocations = useMemo(() => {
    return allocations.filter(
      a => isSameDate(a.date, selectedDate) && matchesSession(a.session, selectedSession)
    );
  }, [allocations, selectedDate, selectedSession]);

  // Count allocations for Morning, Afternoon, and Full Day on the chosen date
  const sessionDutyCounts = useMemo(() => {
    const morning = allocations.filter(a => isSameDate(a.date, selectedDate) && matchesSession(a.session, 'Morning')).length;
    const afternoon = allocations.filter(a => isSameDate(a.date, selectedDate) && matchesSession(a.session, 'Afternoon')).length;
    const fullDay = allocations.filter(a => isSameDate(a.date, selectedDate) && normalizeSession(a.session) === 'Full Day').length;
    const totalOnDate = allocations.filter(a => isSameDate(a.date, selectedDate)).length;
    return { morning, afternoon, fullDay, totalOnDate };
  }, [allocations, selectedDate]);

  // Selected source allocation
  const sourceAllocation = activeAllocations.find(a => a.id === selectedAllocationId);

  // Filter faculties available for reassignment:
  // - Exclude the currently assigned faculty
  // - Prefer showing their department
  const originalFacultyName = sourceAllocation?.facultyName.trim().toLowerCase();
  
  const availableTargetFaculties = useMemo(() => {
    return faculties
      .filter(f => f.name.trim().toLowerCase() !== originalFacultyName)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [faculties, originalFacultyName]);

  const targetFacultyObj = faculties.find(f => f.id === targetFacultyId);

  const handleConfirmReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Authorization required to perform duty adjustment.", "error");
      return;
    }
    if (!sourceAllocation) {
      showToast("Please select the active duty allocation to reassign.", "warning");
      return;
    }
    if (!targetFacultyObj) {
      showToast("Please select the replacement faculty member.", "warning");
      return;
    }

    // Check if the replacement faculty member is already allocated a duty on this date and session
    const isAlreadyAssigned = allocations.some(
      alloc => 
        alloc.id !== sourceAllocation.id &&
        isSameDate(alloc.date, selectedDate) && 
        matchesSession(alloc.session, selectedSession) && 
        alloc.facultyName.trim().toLowerCase() === targetFacultyObj.name.trim().toLowerCase()
    );

    if (isAlreadyAssigned) {
      showToast(`${targetFacultyObj.name} is already assigned a duty on ${formatDisplayDate(selectedDate)} (${selectedSession}). Please select a different replacement faculty member.`, "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create record to update in Firestore/LocalStorage
      const updatedRecord: Omit<ExamAllocation, 'id' | 'createdAt'> = {
        facultyName: targetFacultyObj.name,
        department: targetFacultyObj.department,
        date: normalizeDateToISO(sourceAllocation.date) || sourceAllocation.date,
        session: sourceAllocation.session,
        isAdjusted: true,
        adjustedFrom: sourceAllocation.facultyName,
        checkedLog: sourceAllocation.checkedLog,
        isUnassigned: false,
        unassignedReason: undefined
      };

      const success = await onUpdateAllocation(sourceAllocation.id, updatedRecord);
      if (success) {
        showToast(`Successfully reassigned duty from ${sourceAllocation.facultyName} to ${targetFacultyObj.name}`, 'success');
        setSelectedAllocationId('');
        setTargetFacultyId('');
      }
    } catch (err: any) {
      showToast(err.message || "Failed to adjust duty allocation.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
      {/* Visual Header Banner */}
      <div className="bg-gradient-to-r from-red-600 to-amber-600 rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden select-none">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 translate-y-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Duty Reassignment &amp; Emergency Adjustment
            </h2>
            <p className="text-xs sm:text-sm text-red-50 font-medium leading-relaxed max-w-3xl">
              Quickly reassign or replace invigilators on specific exam dates and sessions. Adjusted allocations are clearly tracked.
            </p>
          </div>
        </div>
      </div>

      {!isAdmin ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm space-y-6 my-4">
          <div className="inline-flex p-4 bg-amber-50 text-amber-600 rounded-full">
            <ShieldAlert className="h-8 w-8 text-amber-600 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-extrabold text-slate-800">
              Administrative Privilege Required
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Duty adjustment and official reassignments require authentication. Please log in using administrative credentials to access emergency staff shift tools.
            </p>
          </div>
          <button
            onClick={onLoginClick}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <UserCheck className="h-4 w-4" />
            <span>Log In as Admin</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Form Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-150 p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-red-600 rounded"></span>
                <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Reassignment Selector</h3>
              </div>
              {sessionDutyCounts.totalOnDate > 0 && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  {sessionDutyCounts.totalOnDate} Duties Scheduled on Date
                </span>
              )}
            </div>

            <form onSubmit={handleConfirmReassignment} className="space-y-4">
              {/* STEP 1: Select Date and Session */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider mb-1.5">
                    1. Examination Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={normalizedSelectedDate || selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedAllocationId('');
                        setTargetFacultyId('');
                      }}
                      className="w-full bg-slate-50/50 hover:bg-slate-50 border-2 border-slate-200 focus:border-red-600 focus:bg-white rounded-xl py-2 px-3 pl-10 text-xs sm:text-sm text-slate-800 font-bold transition-all outline-none"
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 font-semibold">
                    Selected: <strong className="text-slate-800">{formatDisplayDate(selectedDate)}</strong>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider mb-1.5">
                    2. Exam Session
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      value={selectedSession}
                      onChange={(e) => {
                        setSelectedSession(e.target.value as Session);
                        setSelectedAllocationId('');
                        setTargetFacultyId('');
                      }}
                      className="w-full bg-slate-50/50 hover:bg-slate-50 border-2 border-slate-200 focus:border-red-600 focus:bg-white rounded-xl py-2 px-3 pl-10 text-xs sm:text-sm text-slate-800 font-bold transition-all outline-none cursor-pointer"
                    >
                      <option value="Morning">
                        Morning Session ({sessionDutyCounts.morning} Assigned)
                      </option>
                      <option value="Afternoon">
                        Afternoon Session ({sessionDutyCounts.afternoon} Assigned)
                      </option>
                      <option value="Full Day">
                        Full Day ({sessionDutyCounts.fullDay} Assigned)
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* STEP 2: Select Staff to Reassign (From) */}
              <div>
                <label className="block text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider mb-1.5">
                  3. Select Faculty Currently on Duty ({activeAllocations.length} Assigned)
                </label>
                {activeAllocations.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <p className="text-xs font-bold text-slate-500">
                      No active duty allocations found for <span className="text-red-700 font-black">{formatDisplayDate(selectedDate)}</span> ({selectedSession}).
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedAllocationId}
                    onChange={(e) => {
                      setSelectedAllocationId(e.target.value);
                      setTargetFacultyId('');
                    }}
                    className="w-full bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 focus:border-red-600 focus:bg-white rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 font-bold transition-all outline-none cursor-pointer"
                  >
                    <option value="">-- Choose faculty to reassign ({activeAllocations.length} available) --</option>
                    {activeAllocations.map(alloc => {
                      const matched = findFaculty(faculties, alloc.facultyName);
                      const displayName = matched ? matched.name : alloc.facultyName;
                      const sessionTag = normalizeSession(alloc.session) === 'Full Day' ? ' [Full Day Slot]' : '';
                      const adjustedTag = alloc.isAdjusted ? ` [Adjusted from ${alloc.adjustedFrom || 'Prior Staff'}]` : '';
                      const unassignedTag = alloc.isUnassigned ? ' [Unassigned Slot]' : '';
                      return (
                        <option key={alloc.id} value={alloc.id}>
                          {displayName} - {alloc.department} ({alloc.session}){sessionTag}{unassignedTag}{adjustedTag}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* STEP 3: Select Replacement Faculty (To) */}
              {sourceAllocation && (
                <div className="space-y-4 animate-fadeIn">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider mb-1.5">
                      4. Select Replacement Faculty Member
                    </label>
                    <select
                      value={targetFacultyId}
                      onChange={(e) => setTargetFacultyId(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 focus:border-red-600 focus:bg-white rounded-xl py-2.5 px-3 text-xs sm:text-sm text-slate-800 font-bold transition-all outline-none cursor-pointer"
                    >
                      <option value="">-- Choose replacement faculty --</option>
                      {availableTargetFaculties.map(fac => {
                        const hasDuty = allocations.some(
                          alloc => 
                            alloc.id !== sourceAllocation.id &&
                            isSameDate(alloc.date, selectedDate) && 
                            matchesSession(alloc.session, selectedSession) && 
                            alloc.facultyName.trim().toLowerCase() === fac.name.trim().toLowerCase()
                        );
                        return (
                          <option 
                            key={fac.id} 
                            value={fac.id}
                            style={hasDuty ? { backgroundColor: '#fee2e2', color: '#991b1b' } : undefined}
                            className={hasDuty ? 'bg-red-100 text-red-800 font-bold' : ''}
                          >
                            {fac.name} ({fac.department}){hasDuty ? ' - [ALREADY ASSIGNED ON THIS SESSION]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Reason Input */}
                  <div>
                    <label className="block text-[10px] sm:text-xs font-black uppercase text-slate-500 tracking-wider mb-1.5">
                      5. Reassignment Reason / Notes
                    </label>
                    <input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="e.g. Medical Emergency, Invigilation clashes, sudden leave..."
                      className="w-full bg-slate-50/50 border-2 border-slate-200 focus:border-red-600 focus:bg-white rounded-xl py-2.5 px-3.5 text-xs text-slate-850 font-semibold transition-all outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Confirm Reassignment button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!sourceAllocation || !targetFacultyId || isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none text-white rounded-xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Processing Shift...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4.5 w-4.5" />
                      <span>Confirm Duty Reassignment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Visual Shift Preview Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-250 mb-4">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <h3 className="font-extrabold text-slate-800 text-xs sm:text-sm">Shift Summary Preview</h3>
              </div>

              {sourceAllocation && targetFacultyObj ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-white border border-slate-150 rounded-xl p-3.5 shadow-sm space-y-2">
                    <div className="text-[10px] font-black uppercase text-slate-400">Original Assigned Staff</div>
                    <div className="font-black text-slate-800 text-sm">
                      {findFaculty(faculties, sourceAllocation.facultyName)?.name || sourceAllocation.facultyName}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Dept: {sourceAllocation.department}</div>
                  </div>

                  <div className="flex justify-center my-1 select-none">
                    <div className="inline-flex p-1.5 bg-red-100 text-red-700 rounded-full border border-red-200 shadow-sm animate-bounce">
                      <ArrowRight className="h-4.5 w-4.5 rotate-90 lg:rotate-0" />
                    </div>
                  </div>

                  <div className="bg-white border border-red-150 rounded-xl p-3.5 shadow-sm space-y-2 bg-red-50/20">
                    <div className="text-[10px] font-black uppercase text-red-600">New Reassigned Staff</div>
                    <div className="font-black text-red-950 text-sm">{targetFacultyObj.name}</div>
                    <div className="text-[10px] font-bold text-red-700 uppercase">Dept: {targetFacultyObj.department}</div>
                  </div>

                  <div className="text-[11px] text-slate-500 font-semibold italic text-center pt-2">
                    "Shift scheduled for {formatDisplayDate(selectedDate)} ({selectedSession})"
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                  <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <p className="max-w-[200px] leading-relaxed">
                    Select an examination date, session, active staff, and a replacement staff to generate dynamic shift log.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400 font-semibold leading-relaxed">
              <strong>Emergency Note:</strong> When reassigned, the system records the replacement staff and stores the original on-duty staff, which is highlighted across reports.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
