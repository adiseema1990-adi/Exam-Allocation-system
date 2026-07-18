import React, { useState, useEffect } from 'react';
import { PlusCircle, RotateCcw, AlertCircle, Save } from 'lucide-react';
import { Department, Session, ExamAllocation, Faculty } from '../types';
import { sanitizeAndCapitalizeName } from '../utils';
import { subscribeToFaculties } from '../firebase';

interface AllocationFormProps {
  onSubmit: (data: Omit<ExamAllocation, 'id' | 'createdAt'>) => Promise<boolean>;
  isLoading: boolean;
  editRecord?: ExamAllocation | null;
  onCancelEdit?: () => void;
}

const DEPARTMENTS: Department[] = [
  'CSE',
  'ECE',
  'Mechanical',
  'Civil',
  'AIML',
  'MBA',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Humanities',
  'Others',
];

const SESSIONS: Session[] = ['Forenoon', 'Afternoon', 'Full Day'];

export function AllocationForm({ onSubmit, isLoading, editRecord, onCancelEdit }: AllocationFormProps) {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [facultyName, setFacultyName] = useState('');
  const [department, setDepartment] = useState<Department | ''>('');
  const [date, setDate] = useState('');
  const [session, setSession] = useState<Session | ''>('');
  const [errorText, setErrorText] = useState('');

  // Subscribe to registered faculties in campus directory
  useEffect(() => {
    const unsubscribe = subscribeToFaculties((fetched) => {
      setFaculties(fetched);
    });
    return () => unsubscribe();
  }, []);

  // Handle load context when editing a record
  useEffect(() => {
    if (editRecord) {
      setFacultyName(editRecord.facultyName);
      setDepartment(editRecord.department);
      setDate(editRecord.date);
      setSession(editRecord.session);
      setErrorText('');
    } else {
      handleReset();
    }
  }, [editRecord]);

  const handleReset = () => {
    setFacultyName('');
    setDepartment('');
    setDate('');
    setSession('');
    setErrorText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    const trimmedName = facultyName.trim();
    if (!trimmedName) {
      setErrorText('Faculty name is mandatory.');
      return;
    }

    if (!department) {
      setErrorText('Please select an academic department.');
      return;
    }

    if (!date) {
      setErrorText('Please select a valid date.');
      return;
    }

    if (!session) {
      setErrorText('Please specify the duty session.');
      return;
    }

    // Submit payload
    const capitalizedName = sanitizeAndCapitalizeName(trimmedName);
    const success = await onSubmit({
      facultyName: capitalizedName,
      department,
      date,
      session,
    });

    if (success && !editRecord) {
      handleReset();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
      {/* Title block with Geometric Indicator */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center">
          <span className="w-2 h-6 bg-orange-500 rounded mr-3 inline-block"></span>
          <h3 className="text-lg font-bold text-slate-800">
            {editRecord ? 'Modify Duty Allocation' : 'New Allocation'}
          </h3>
        </div>
        {editRecord && (
          <button
            onClick={onCancelEdit}
            className="text-xs font-bold px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
          >
            Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {errorText && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm font-medium">
            <AlertCircle className="h-4.5 w-4.5 flex-shrink-0 text-red-500" />
            <span>{errorText}</span>
          </div>
        )}

        {/* Form Inputs Grid: 4 columns in a single row on desktop (md+), 2 columns (2x2 grid) on mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Faculty Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Faculty Name <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              className="w-full p-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-900 outline-none text-slate-800 focus:ring-0 transition-colors text-sm font-semibold bg-white cursor-pointer"
              value={facultyName}
              onChange={(e) => {
                const val = e.target.value;
                setFacultyName(val);
                const chosen = faculties.find(f => f.name === val);
                if (chosen) {
                  setDepartment(chosen.department);
                }
              }}
              disabled={isLoading}
            >
              <option value="">Select Faculty Member</option>
              {faculties.map((f) => (
                <option key={f.id} value={f.name}>
                  {f.name} ({f.department})
                </option>
              ))}
            </select>
          </div>

          {/* Department Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Department <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              className="w-full p-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-900 outline-none text-slate-800 focus:ring-0 transition-colors text-sm font-medium bg-slate-50 cursor-not-allowed"
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
              disabled={true}
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Date <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              type="date"
              className="w-full p-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-900 outline-none text-slate-800 focus:ring-0 transition-colors text-sm font-medium bg-white"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Session Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Session <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              className="w-full p-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-900 outline-none text-slate-800 focus:ring-0 transition-colors text-sm font-medium bg-white"
              value={session}
              onChange={(e) => setSession(e.target.value as Session)}
              disabled={isLoading}
            >
              <option value="">Select Session</option>
              {SESSIONS.map((sess) => (
                <option key={sess} value={sess}>
                  {sess}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
          💡 Select Name to Auto-Populate Department. Add new scholars in the "Faculty Register" tab.
        </p>

        {/* Action Controls */}
        <div className="pt-4 flex space-x-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-400 disabled:shadow-none"
          >
            {isLoading ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="h-4 w-4 text-orange-400" />
            )}
            {editRecord ? 'Update Allocation' : 'Save Allocation'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="px-6 py-3 border-2 border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
