import React, { useState, useEffect } from 'react';
import { 
  Search, 
  PlusCircle, 
  FileSpreadsheet, 
  CalendarRange, 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  BookOpen,
  Info,
  Lock,
  Unlock,
  User,
  LogOut,
  Phone
} from 'lucide-react';
import { ExamAllocation, Faculty } from './types';
import { 
  subscribeToAllocations, 
  addAllocation, 
  updateAllocation, 
  removeAllocation, 
  isRealConfig,
  validateFirestoreConnection,
  subscribeToAuth,
  loginWithEmailPassword,
  logoutUser,
  AuthUser,
  getIsFallbackMode,
  subscribeToFaculties
} from './firebase';
import { Dashboard } from './components/Dashboard';
import { isToday, formatDisplayDate } from './utils';
import { AllocationForm } from './components/AllocationForm';
import { AllAllocationsTable } from './components/AllAllocationsTable';
import { FacultyReport } from './components/FacultyReport';
import { FacultyRegistry } from './components/FacultyRegistry';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';

export default function App() {
  const [allocations, setAllocations] = useState<ExamAllocation[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [showTodayDutiesModal, setShowTodayDutiesModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'add' | 'all' | 'report' | 'faculty'>('all');
  const [editingRecord, setEditingRecord] = useState<ExamAllocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Auth state variables
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Show instructions panel by default
  const [showConfigInstruction, setShowConfigInstruction] = useState(true);

  // Self-healing fallback state
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    const checkFallback = () => {
      setIsFallback(getIsFallbackMode());
    };
    checkFallback();

    const handleFallback = () => {
      setIsFallback(true);
    };

    window.addEventListener('firebase-fallback-detected', handleFallback);
    return () => {
      window.removeEventListener('firebase-fallback-detected', handleFallback);
    };
  }, []);

  // Subscribe to Authentication state
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Initialize and subscribe to Firestore
  useEffect(() => {
    setIsLoading(true);
    validateFirestoreConnection();
    
    const unsubscribe = subscribeToAllocations((fetchedData) => {
      setAllocations(fetchedData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to Faculties state
  useEffect(() => {
    const unsub = subscribeToFaculties((fetchedFaculties) => {
      setFaculties(fetchedFaculties);
    });
    return () => unsub();
  }, []);

  // Format local today date to displayable string (e.g., Jun 22, 2026)
  const getIsFormattedTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return formatDisplayDate(`${year}-${month}-${day}`);
  };

  // Utility toast dispatcher
  const showToast = (text: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Submit allocation handler (supports both creating and editing)
  const handleSubmitAllocation = async (record: Omit<ExamAllocation, 'id' | 'createdAt'>): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (editingRecord) {
        // Double check duplicates (excluding current item)
        const isDuplicate = allocations.some(
          a => a.id !== editingRecord.id &&
               a.facultyName.toLowerCase().trim() === record.facultyName.toLowerCase().trim() &&
               a.date === record.date &&
               a.session === record.session
        );

        if (isDuplicate) {
          showToast("Allocation already exists.", "error");
          setIsLoading(false);
          return false;
        }

        await updateAllocation(editingRecord.id, record);
        showToast("Updated Successfully", "success");
        setEditingRecord(null);
        setActiveTab('all'); // Go back to listings
      } else {
        // Double check duplicates
        const isDuplicate = allocations.some(
          a => a.facultyName.toLowerCase().trim() === record.facultyName.toLowerCase().trim() &&
               a.date === record.date &&
               a.session === record.session
        );

        if (isDuplicate) {
          showToast("Allocation already exists.", "error");
          setIsLoading(false);
          return false;
        }

        await addAllocation(record);
        showToast("Saved Successfully", "success");
        setActiveTab('all'); // Visual switch to summary
      }
      return true;
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "An unexpected error occurred.", "error");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete handler
  const handleDeleteAllocation = async (id: string) => {
    setIsLoading(true);
    try {
      await removeAllocation(id);
      showToast("Deleted Successfully", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to delete allocation.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTrigger = (record: ExamAllocation) => {
    setEditingRecord(record);
    setActiveTab('add'); // Switch back to editing form
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setActiveTab('all');
  };

  return (
    <div className="min-h-screen text-slate-800 flex flex-col antialiased">
      
      {/* FIXED Elegant Centered Header context */}
      <header className="bg-blue-900 text-white p-4 shadow-lg sticky top-0 z-40 flex-none print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Centered Typography layout */}
          <div className="flex flex-col text-center md:text-left">
            <span className="text-xs tracking-widest opacity-85 uppercase font-light text-indigo-100">
              HKE Society's
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight mt-0.5">
              Sir M. Visvesvaraya College of Engineering, Raichur
            </h1>
            <h2 className="text-orange-400 font-serif italic text-base sm:text-lg mt-1 tracking-wide font-medium">
              Exam Duty Allocation System
            </h2>
          </div>

          {/* Search box & Auth Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            
            {/* Search box top-right */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search Faculty or Dept..."
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-blue-800 border border-blue-700 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-3 top-2.5 text-blue-300 pointer-events-none">
                <Search className="h-3.5 w-3.5" />
              </span>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Auth panel */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-emerald-800/80 border border-emerald-600/60 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-100 shadow-inner w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-1.5">
                  <Unlock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate max-w-[130px] sm:max-w-[180px]" title={currentUser.email}>
                    {currentUser.email}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await logoutUser();
                      showToast("Signed out successfully", "success");
                    } catch (e: any) {
                      showToast(e.message, "error");
                    }
                  }}
                  className="hover:bg-emerald-900/85 hover:text-white text-emerald-200 px-2 py-0.5 rounded transition-colors text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-emerald-600/40 ml-2"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setLoginEmail('');
                  setLoginPassword('');
                  setAuthError('');
                  setShowLoginModal(true);
                }}
                className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer w-full sm:w-auto"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Admin Login</span>
              </button>
            )}
            
          </div>

        </div>
      </header>

      {/* Main Container Grid */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 print:p-0">
        
        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="fixed top-18 right-6 z-50 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg border border-indigo-500 font-semibold text-xs animate-pulse print:hidden">
            <div className="h-4.5 w-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Syncing database...</span>
          </div>
        )}

        {/* Extra Feature: Dashboard counter cards */}
        <Dashboard 
          allocations={allocations} 
          onTodayDutiesClick={() => setShowTodayDutiesModal(true)}
        />

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-gray-200 mb-6 flex-none print:hidden overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 font-bold text-sm transition-all cursor-pointer flex items-center gap-2 -mb-px z-10 ${
              activeTab === 'all'
                ? 'bg-white border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                : 'text-gray-500 hover:text-blue-900 font-medium'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            All Allocations
            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'all' ? 'bg-blue-50 text-blue-900' : 'bg-slate-100 text-slate-500'
            }`}>
              {allocations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`px-6 py-3 font-bold text-sm transition-all cursor-pointer flex items-center gap-2 -mb-px z-10 ${
              activeTab === 'add'
                ? 'bg-white border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                : 'text-gray-500 hover:text-blue-900 font-medium'
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            {editingRecord ? 'Modify Allocation' : 'Add Faculty Allocation'}
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`px-6 py-3 font-bold text-sm transition-all cursor-pointer flex items-center gap-2 -mb-px z-10 ${
              activeTab === 'report'
                ? 'bg-white border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                : 'text-gray-500 hover:text-blue-900 font-medium'
            }`}
          >
            <CalendarRange className="h-4 w-4" />
            Faculty Wise Report
          </button>

          <button
            onClick={() => setActiveTab('faculty')}
            className={`px-6 py-3 font-bold text-sm transition-all cursor-pointer flex items-center gap-2 -mb-px z-10 ${
              activeTab === 'faculty'
                ? 'bg-white border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                : 'text-gray-500 hover:text-blue-900 font-medium'
            }`}
          >
            <Database className="h-4 w-4" />
            Faculty Register
          </button>
        </div>

        {/* Dynamic Inner Views */}
        <div className="transition-all duration-300">
          {activeTab === 'add' ? (
            currentUser ? (
              <AllocationForm
                onSubmit={handleSubmitAllocation}
                isLoading={isLoading}
                editRecord={editingRecord}
                onCancelEdit={handleCancelEdit}
              />
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm space-y-6 my-4">
                <div className="inline-flex p-4 bg-amber-50 text-amber-600 rounded-full">
                  <Lock className="h-8 w-8 text-amber-600 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-extrabold text-slate-800">
                    Academic Assistant Authorization Required
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    You are currently viewing in strict read-only mode. Adding or editing faculty duty structures requires authenticating as an SMVCER administrator.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setLoginEmail('');
                    setLoginPassword('');
                    setAuthError('');
                    setShowLoginModal(true);
                  }}
                  className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-955 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Log In as Admin</span>
                </button>
              </div>
            )
          ) : activeTab === 'all' ? (
            <AllAllocationsTable
              allocations={allocations}
              onEdit={handleEditTrigger}
              onDelete={handleDeleteAllocation}
              searchQuery={searchQuery}
              isAdmin={currentUser !== null}
            />
          ) : activeTab === 'faculty' ? (
            currentUser ? (
              <FacultyRegistry
                showToast={showToast}
              />
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm space-y-6 my-4">
                <div className="inline-flex p-4 bg-amber-50 text-amber-600 rounded-full">
                  <Lock className="h-8 w-8 text-amber-600 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-extrabold text-slate-800">
                    Faculty Register Locked
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    Managing the registered directory of research scholars and teaching staff is restricted to verified college office administrators.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setLoginEmail('');
                    setLoginPassword('');
                    setAuthError('');
                    setShowLoginModal(true);
                  }}
                  className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-955 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Log In as Admin</span>
                </button>
              </div>
            )
          ) : (
            <FacultyReport 
              allocations={allocations} 
              searchQuery={searchQuery}
            />
          )}
        </div>

      </main>

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 relative">
            <button
              onClick={() => {
                setShowLoginModal(false);
                setAuthError('');
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              title="Close Panel"
            >
              ✕
            </button>

            <div className="text-center space-y-2 mb-6">
              <div className="inline-flex p-3 bg-blue-50 text-blue-900 rounded-full">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800">
                Academic Administration Login
              </h3>
              <p className="text-xs text-slate-500">
                Authenticate with your college coordinates to modify allocations and manage directories.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthLoading(true);
                setAuthError('');
                try {
                  const logged = await loginWithEmailPassword(loginEmail, loginPassword);
                  showToast(`Successfully authenticated as ${logged.email}`, "success");
                  setShowLoginModal(false);
                } catch (err: any) {
                  setAuthError(err?.message || "Invalid credentials.");
                } finally {
                  setAuthLoading(false);
                }
              }}
              className="space-y-4"
            >
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g., admin@smvcer.ac.in"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-slate-800 text-sm outline-none focus:border-blue-950 transition-colors bg-white font-medium"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Administrator Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Type password..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-slate-800 text-sm outline-none focus:border-blue-950 transition-colors bg-white font-medium"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-sm font-extrabold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
                <span>{authLoading ? "Authorizing Identity..." : "Sign In to Admin Panel"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Today's Duties Modal */}
      {showTodayDutiesModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full p-4 sm:p-6 relative flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <button
              onClick={() => setShowTodayDutiesModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer z-10"
              title="Close Panel"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 select-none">
              <div className="p-2 sm:p-3 bg-orange-100 text-orange-600 rounded-xl shrink-0">
                <CalendarRange className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-800 truncate">
                  Today's Examination Duties
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                  Date: {getIsFormattedTodayDate()}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto pr-1 flex-grow min-h-0">
              {allocations.filter(a => isToday(a.date)).length === 0 ? (
                <div className="text-center py-8 sm:py-12 px-4">
                  <div className="inline-flex p-3 sm:p-4 bg-emerald-50 text-emerald-600 rounded-full mb-2 sm:mb-3">
                    <CheckCircle className="h-6 sm:h-8 w-6 sm:w-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">All Clear!</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    There are no faculty duties scheduled for today's examination dates.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-150 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto w-full">
                    <table className="min-w-[500px] sm:min-w-full text-left border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-150 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                          <th className="px-3 py-2 sm:px-4 sm:py-3 w-12 text-center text-[10px]">S.N.</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 text-[10px]">Faculty Name</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 text-[10px]">Department</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 text-[10px]">Phone Number</th>
                          <th className="px-3 py-2 sm:px-4 sm:py-3 text-[10px]">Session</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-medium">
                        {allocations
                          .filter(a => isToday(a.date))
                          .map((alloc, idx) => {
                            const norm = alloc.facultyName.trim().toLowerCase();
                            const matchedFac = faculties.find(f => f.name.trim().toLowerCase() === norm);
                            const phoneNumber = matchedFac?.phone;

                            return (
                              <tr key={alloc.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-3 py-2 sm:px-4 sm:py-3 w-12 text-center font-mono text-slate-400 text-[11px]">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3 font-extrabold text-slate-900">
                                  {alloc.facultyName}
                                </td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3">
                                  <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-50/70 text-blue-950 text-[10px] uppercase font-black tracking-wide border border-blue-100">
                                    {alloc.department}
                                  </span>
                                </td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3 text-slate-800">
                                  {phoneNumber ? (
                                    <a href={`tel:${phoneNumber}`} className="flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-all">
                                      <Phone className="h-3 w-3 inline text-slate-400 shrink-0" />
                                      <span className="font-mono">{phoneNumber}</span>
                                    </a>
                                  ) : (
                                    <span className="text-slate-300 italic">Not specified</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 sm:px-4 sm:py-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide uppercase ${
                                    alloc.session === 'Forenoon'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                                      : alloc.session === 'Afternoon'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200/50'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                  }`}>
                                    {alloc.session}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowTodayDutiesModal(false)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Screen Footer */}
      <footer className="bg-slate-900 text-slate-500 text-xs text-center py-6 border-t border-slate-800 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            &copy; 2026 Admin Portal. Sir M. Visvesvaraya College of Engineering, Raichur. All rights reserved.
          </p>
          <p>
            Generated dynamically by <strong>Exam Duty Allocation System</strong>
          </p>
        </div>
      </footer>

    </div>
  );
}
