import React, { useState, useEffect, useRef } from 'react';
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
  Phone,
  Sparkles,
  RefreshCw,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Settings,
  Download,
  Upload,
  FileJson
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
  subscribeToFaculties,
  importAndMergeData
} from './firebase';
import { Dashboard } from './components/Dashboard';
import { isToday, formatDisplayDate, findFaculty } from './utils';
import { AllocationForm } from './components/AllocationForm';
import { AllAllocationsTable } from './components/AllAllocationsTable';
import { FacultyReport } from './components/FacultyReport';
import { FacultyRegistry } from './components/FacultyRegistry';
import { AutoAllocation } from './components/AutoAllocation';
import { DutyAdjustment } from './components/DutyAdjustment';
import { FacultyDutySummary } from './components/FacultyDutySummary';
import { FacultyDutyGrid } from './components/FacultyDutyGrid';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';

export default function App() {
  const [allocations, setAllocations] = useState<ExamAllocation[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [showTodayDutiesModal, setShowTodayDutiesModal] = useState(false);
  const [showSelectedDateDutiesModal, setShowSelectedDateDutiesModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // Export/Import state
  const [dragActive, setDragActive] = useState(false);
  const [parsedAllocations, setParsedAllocations] = useState<any[]>([]);
  const [parsedFaculties, setParsedFaculties] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [selectedCustomDate, setSelectedCustomDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'add' | 'all' | 'report' | 'faculty' | 'auto' | 'adjust' | 'summary' | 'grid'>('all');
  const [editingRecord, setEditingRecord] = useState<ExamAllocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  // Auth state variables
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignOutConfirmModal, setShowSignOutConfirmModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Show instructions panel by default
  const [showConfigInstruction, setShowConfigInstruction] = useState(true);

  // Self-healing fallback state
  const [isFallback, setIsFallback] = useState(false);

  // Tab scrolling and arrow visibility state
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkTabsScroll = () => {
    const container = tabsContainerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftArrow(scrollLeft > 2);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = tabsContainerRef.current;
    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (container) {
      checkTabsScroll();
      container.addEventListener('scroll', checkTabsScroll);
      window.addEventListener('resize', checkTabsScroll);
      
      const observer = new ResizeObserver(checkTabsScroll);
      observer.observe(container);
      
      // Delay check slightly to allow elements to settle
      const timer = setTimeout(checkTabsScroll, 300);
      
      return () => {
        container.removeEventListener('scroll', checkTabsScroll);
        window.removeEventListener('resize', checkTabsScroll);
        observer.disconnect();
        clearTimeout(timer);
      };
    }
  }, [allocations.length, activeTab]);

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

  // Splash Screen Timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFadingOut(true);
      const removeTimer = setTimeout(() => {
        setShowSplash(false);
      }, 500); // match transition-opacity duration-500
      return () => clearTimeout(removeTimer);
    }, 2200); // show splash for 2.2 seconds
    return () => clearTimeout(timer);
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

  // Direct allocation update handler (e.g. for Duty adjustments)
  const handleUpdateAllocationDirect = async (id: string, record: Omit<ExamAllocation, 'id' | 'createdAt'>): Promise<boolean> => {
    setIsLoading(true);
    try {
      await updateAllocation(id, record);
      return true;
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "An unexpected error occurred during reassignment.", "error");
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setParseError(null);
    setImportSuccessMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        
        let parsedAllocs: any[] = [];
        let parsedFacs: any[] = [];

        if (Array.isArray(json)) {
          parsedAllocs = json;
        } else if (typeof json === 'object' && json !== null) {
          if (Array.isArray(json.allocations)) {
            parsedAllocs = json.allocations;
          }
          if (Array.isArray(json.faculties)) {
            parsedFacs = json.faculties;
          }
          if (!Array.isArray(json.allocations) && !Array.isArray(json.faculties)) {
            throw new Error("Invalid format. The JSON should be either an array of allocations, or an object containing 'allocations' and/or 'faculties' arrays.");
          }
        } else {
          throw new Error("Invalid JSON format.");
        }

        // Quick visual validation of properties
        const invalidAllocations = parsedAllocs.some(a => !a.facultyName || !a.date || !a.session);
        if (invalidAllocations) {
          throw new Error("Some allocations are missing required fields (facultyName, date, session).");
        }

        setParsedAllocations(parsedAllocs);
        setParsedFaculties(parsedFacs);
      } catch (err: any) {
        setParseError(err?.message || "Failed to parse JSON file.");
        setParsedAllocations([]);
        setParsedFaculties([]);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleExport = () => {
    try {
      const cleanAllocations = allocations.map(({ id, createdAt, ...rest }) => ({
        ...rest,
        createdAt: typeof createdAt === 'object' && createdAt !== null && 'seconds' in createdAt
          ? { seconds: (createdAt as any).seconds, nanoseconds: (createdAt as any).nanoseconds }
          : createdAt
      }));

      const cleanFaculties = faculties.map(({ id, createdAt, ...rest }) => ({
        ...rest,
        createdAt: typeof createdAt === 'object' && createdAt !== null && 'seconds' in createdAt
          ? { seconds: (createdAt as any).seconds, nanoseconds: (createdAt as any).nanoseconds }
          : createdAt
      }));

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          allocations: cleanAllocations,
          faculties: cleanFaculties
        }, null, 2)
      );
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute("download", `exam_duty_database_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Database exported successfully!", "success");
    } catch (err: any) {
      showToast("Export failed: " + err.message, "error");
    }
  };

  const handleImportMerge = async () => {
    if (parsedAllocations.length === 0 && parsedFaculties.length === 0) return;
    setIsImporting(true);
    try {
      const result = await importAndMergeData(parsedAllocations, parsedFaculties);
      showToast(`Successfully merged data! Added ${result.addedAllocationsCount} allocations and ${result.addedFacultiesCount} faculties.`, "success");
      setImportSuccessMsg(`Import successful! Merged ${result.addedAllocationsCount} new allocations and ${result.addedFacultiesCount} new faculties. Duplicates were automatically skipped.`);
      setParsedAllocations([]);
      setParsedFaculties([]);
    } catch (err: any) {
      showToast("Failed to import data: " + err.message, "error");
      setParseError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-800 flex flex-col antialiased">
      {/* PWA Splash Screen Overlay */}
      {showSplash && (
        <div className={`fixed inset-0 z-50 bg-white flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col items-center gap-6 text-center select-none">
            {/* Animated Icon Wrapper with subtle shadow and light pulses */}
            <div className="w-36 h-36 relative flex items-center justify-center">
              <div className="absolute -inset-4 bg-orange-100/50 rounded-full blur-xl animate-pulse"></div>
              <img 
                src="/icon.svg" 
                alt="SMVCER Logo" 
                className="w-full h-full object-contain relative z-10 animate-bounce"
                style={{ animationDuration: '2s' }}
                referrerPolicy="no-referrer" 
              />
            </div>
            
            {/* "SMVCER" Text with solid white background and vibrant orange font */}
            <div className="bg-white px-8 py-3.5 rounded-2xl shadow-sm border border-slate-100">
              <h1 className="text-orange-500 font-extrabold text-4xl tracking-widest font-sans drop-shadow-sm">
                SMVCER
              </h1>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-2">
                Exam Duty Allocation
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* FIXED Elegant Centered Header context */}
      <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-40 flex-none print:hidden">
        
        {/* Desktop Header View (hidden on mobile, visible on medium screens and up) */}
        <div className="hidden md:block p-4">
          <div className="max-w-7xl mx-auto flex flex-row justify-between items-center gap-4">
            {/* Centered Typography layout */}
            <div className="flex flex-col text-left">
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
            <div className="flex flex-row items-center gap-3 w-auto justify-end flex-nowrap">
              {/* Search box top-right */}
              <div className="relative w-44 sm:w-56 md:w-68">
                <input
                  type="text"
                  placeholder="Search Faculty/Dept..."
                  className="w-full pl-8 pr-7 py-2 rounded-lg bg-blue-800 border border-blue-700 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="absolute left-2.5 top-2.5 text-blue-300 pointer-events-none">
                  <Search className="h-3.5 w-3.5" />
                </span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Auth panel & Settings */}
              {currentUser ? (
                <button
                  onClick={() => setShowSignOutConfirmModal(true)}
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <Unlock className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLoginEmail('');
                    setLoginPassword('');
                    setAuthError('');
                    setShowLoginModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>Admin Login</span>
                </button>
              )}

              {currentUser && (
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="group flex items-center justify-center p-2 rounded-lg bg-blue-800 hover:bg-blue-700 border border-blue-700/60 text-blue-200 hover:text-white transition-all shadow-md shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                  title="Settings"
                >
                  <Settings className="h-3.5 w-3.5 transition-transform duration-700 ease-in-out group-hover:rotate-180" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Header View (visible only on mobile) */}
        <div className="block md:hidden p-2.5">
          <div className="flex flex-row justify-between items-center gap-2">
            
            {/* Left side text: very compact */}
            <div className="flex flex-col text-left select-none max-w-[50%]">
              <span className="text-[8px] tracking-widest opacity-85 uppercase font-light text-indigo-100 leading-none">
                HKE Society's
              </span>
              <h1 className="text-[10px] xs:text-xs font-black tracking-tight leading-tight mt-0.5 text-white">
                SMV College of Engg., Raichur
              </h1>
              <span className="text-orange-400 font-serif italic text-[9px] xs:text-[10px] mt-0.5 tracking-wide leading-tight font-medium">
                Exam Duty Allocation System
              </span>
            </div>

            {/* Right side controls: search bar, sign out button with icon, settings gear icon */}
            <div className="flex flex-row items-center gap-1.5 shrink-0">
              
              {/* Search Box */}
              <div className="relative w-28 xs:w-36">
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-6 pr-5 py-1 rounded bg-blue-800 border border-blue-700 text-white placeholder-blue-300 focus:outline-none focus:ring-1 focus:ring-orange-500 text-[11px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="absolute left-1.5 top-1.5 text-blue-300 pointer-events-none">
                  <Search className="h-3 w-3" />
                </span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Auth Panel: Admin Login / Sign Out represented as Icons */}
              {currentUser ? (
                <button
                  onClick={() => setShowSignOutConfirmModal(true)}
                  className="flex items-center justify-center p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5 text-white shrink-0" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLoginEmail('');
                    setLoginPassword('');
                    setAuthError('');
                    setShowLoginModal(true);
                  }}
                  className="flex items-center justify-center p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded shadow-sm hover:shadow transition-all cursor-pointer shrink-0"
                  title="Admin Login"
                >
                  <Lock className="h-3.5 w-3.5 shrink-0 text-white" />
                </button>
              )}

              {/* Settings gear icon */}
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="group flex items-center justify-center p-1.5 rounded bg-blue-800 hover:bg-blue-750 border border-blue-700/60 text-blue-200 hover:text-white transition-all shadow-sm shrink-0 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
                  title="Settings"
                >
                  <Settings className="h-3.5 w-3.5 transition-transform duration-700 ease-in-out group-hover:rotate-180" />
                </button>
              )}

            </div>

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
          onSelectedDateDutiesClick={(date) => {
            setSelectedCustomDate(date);
            setShowSelectedDateDutiesModal(true);
          }}
        />

        {/* Navigation Tabs Bar with Scroll Indicators */}
        <div className="relative flex items-center mb-6 border-b border-gray-200 flex-none print:hidden">
          {/* Left Scroll Button Indicator */}
          {showLeftArrow && (
            <button
              onClick={() => scrollTabs('left')}
              className="absolute left-0 z-20 flex items-center justify-center w-10 h-full bg-gradient-to-r from-white via-white/95 to-transparent text-blue-900 hover:text-orange-500 transition-all focus:outline-none cursor-pointer"
              title="Scroll left for more tabs"
            >
              <div className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full shadow-sm border border-slate-200/80 flex items-center justify-center">
                <ChevronLeft className="h-4 w-4" />
              </div>
            </button>
          )}

          {/* Scrollable Tab Container */}
          <div 
            ref={tabsContainerRef} 
            className="flex-grow flex overflow-x-auto whitespace-nowrap scroll-smooth pt-1 pb-2 px-2"
          >
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'all'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              All Allocations
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                activeTab === 'all' ? 'bg-blue-100 text-blue-900 hover:bg-blue-200' : 'bg-slate-100 text-slate-500'
              }`}>
                {allocations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'add'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              {editingRecord ? 'Modify Allocation' : 'Add Faculty Allocation'}
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'report'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <CalendarRange className="h-4 w-4" />
              Faculty Wise Report
            </button>

            <button
              onClick={() => setActiveTab('faculty')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'faculty'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <Database className="h-4 w-4" />
              Faculty Register
            </button>

            <button
              onClick={() => setActiveTab('auto')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'auto'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Auto Allocate
            </button>

            <button
              onClick={() => setActiveTab('adjust')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'adjust'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              Duty Adjustment
            </button>

            <button
              onClick={() => setActiveTab('grid')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'grid'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <CalendarRange className="h-4 w-4" />
              <span>Grid Scheduler</span>
            </button>

            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-2 sm:px-4 sm:py-2 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 -mb-px z-10 ${
                activeTab === 'summary'
                  ? 'bg-blue-50 border-t-2 border-l-2 border-r-2 border-blue-900 text-blue-900 rounded-t-lg shadow-sm'
                  : 'text-gray-500 hover:text-blue-900 font-medium'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              <span>Master Summary</span>
            </button>
          </div>

          {/* Right Scroll Button Indicator */}
          {showRightArrow && (
            <button
              onClick={() => scrollTabs('right')}
              className="absolute right-0 z-20 flex items-center justify-center w-10 h-full bg-gradient-to-l from-white via-white/95 to-transparent text-blue-900 hover:text-orange-500 transition-all focus:outline-none cursor-pointer text-right"
              title="Scroll right for more tabs"
            >
              <div className="bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full shadow-sm border border-slate-200/80 flex items-center justify-center ml-auto">
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          )}
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
              faculties={faculties}
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
          ) : activeTab === 'auto' ? (
            currentUser ? (
              <AutoAllocation
                allocations={allocations}
                faculties={faculties}
                showToast={showToast}
                onSuccess={() => setActiveTab('all')}
              />
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm space-y-6 my-4">
                <div className="inline-flex p-4 bg-amber-50 text-amber-600 rounded-full">
                  <Lock className="h-8 w-8 text-amber-600 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-extrabold text-slate-800">
                    Automated Allocation Engine Locked
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                    Running automated exam duty distributions and importing batch CSV rosters is restricted to verified SMVCER office administrators.
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
          ) : activeTab === 'adjust' ? (
            <DutyAdjustment
              allocations={allocations}
              faculties={faculties}
              isAdmin={currentUser !== null}
              onUpdateAllocation={handleUpdateAllocationDirect}
              onLoginClick={() => {
                setLoginEmail('');
                setLoginPassword('');
                setAuthError('');
                setShowLoginModal(true);
              }}
              showToast={showToast}
            />
          ) : activeTab === 'summary' ? (
            <FacultyDutySummary
              allocations={allocations}
              faculties={faculties}
              isAdmin={currentUser !== null}
              onLoginClick={() => {
                setLoginEmail('');
                setLoginPassword('');
                setAuthError('');
                setShowLoginModal(true);
              }}
              showToast={showToast}
            />
          ) : activeTab === 'grid' ? (
            <FacultyDutyGrid
              allocations={allocations}
              faculties={faculties}
              isAdmin={currentUser !== null}
              onLoginClick={() => {
                setLoginEmail('');
                setLoginPassword('');
                setAuthError('');
                setShowLoginModal(true);
              }}
              showToast={showToast}
              addAllocation={addAllocation}
              removeAllocation={removeAllocation}
            />
          ) : (
            <FacultyReport 
              allocations={allocations} 
              searchQuery={searchQuery}
              faculties={faculties}
              showToast={showToast}
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

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 relative space-y-5">
            <button
              onClick={() => setShowSignOutConfirmModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              title="Close"
            >
              ✕
            </button>

            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-full">
                <LogOut className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-slate-800">
                Confirm Sign Out
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Are you sure you want to sign out from EXAM Allocation System?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSignOutConfirmModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowSignOutConfirmModal(false);
                  try {
                    await logoutUser();
                    showToast("Signed out successfully", "success");
                  } catch (e: any) {
                    showToast(e.message || "Failed to sign out", "error");
                  }
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
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
                          .sort((a, b) => {
                            const dateA = a.date || '';
                            const dateB = b.date || '';
                            if (dateA !== dateB) {
                              return dateA.localeCompare(dateB);
                            }
                            const getSessionPriority = (s: string) => {
                              if (!s) return 4;
                              const val = s.toLowerCase().trim();
                              if (val === 'forenoon' || val === 'fn' || val === 'morning' || val === 'mn') return 1;
                              if (val === 'afternoon' || val === 'an') return 2;
                              if (val === 'full day' || val === 'fullday') return 3;
                              return 4;
                            };
                            return getSessionPriority(a.session) - getSessionPriority(b.session);
                          })
                          .map((alloc, idx) => {
                            const matchedFac = findFaculty(faculties, alloc.facultyName);
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
                                    (alloc.session === 'Morning' || alloc.session === 'Forenoon')
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                                      : alloc.session === 'Afternoon'
                                        ? 'bg-orange-50 text-orange-700 border border-orange-200/50'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                  }`}>
                                    {alloc.session === 'Forenoon' ? 'Morning' : alloc.session}
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

      {/* Selected Date Duties Modal */}
      {showSelectedDateDutiesModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full p-4 sm:p-6 relative flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <button
              onClick={() => setShowSelectedDateDutiesModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer z-10"
              title="Close Panel"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 select-none">
              <div className="p-2 sm:p-3 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                <CalendarRange className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-800 truncate">
                  Examination Duties for Selected Date
                </h3>
                <p className="text-[10px] sm:text-xs text-indigo-600 font-bold">
                  Date: {formatDisplayDate(selectedCustomDate)}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto pr-1 flex-grow min-h-0">
              {allocations.filter(a => a.date === selectedCustomDate).length === 0 ? (
                <div className="text-center py-8 sm:py-12 px-4">
                  <div className="inline-flex p-3 sm:p-4 bg-emerald-50 text-emerald-600 rounded-full mb-2 sm:mb-3">
                    <CheckCircle className="h-6 sm:h-8 w-6 sm:w-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">All Clear!</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                    There are no faculty duties scheduled for this particular date.
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
                          .filter(a => a.date === selectedCustomDate)
                          .sort((a, b) => {
                            const getSessionPriority = (s: string) => {
                              if (!s) return 4;
                              const val = s.toLowerCase().trim();
                              if (val === 'forenoon' || val === 'fn' || val === 'morning' || val === 'mn') return 1;
                              if (val === 'afternoon' || val === 'an') return 2;
                              if (val === 'full day' || val === 'fullday') return 3;
                              return 4;
                            };
                            return getSessionPriority(a.session) - getSessionPriority(b.session);
                          })
                          .map((alloc, idx) => {
                            const matchedFac = findFaculty(faculties, alloc.facultyName);
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
                                    (alloc.session === 'Morning' || alloc.session === 'Forenoon')
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                                      : alloc.session === 'Afternoon'
                                        ? 'bg-orange-50 text-orange-700 border border-orange-200/50'
                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                  }`}>
                                    {alloc.session === 'Forenoon' ? 'Morning' : alloc.session}
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
                onClick={() => setShowSelectedDateDutiesModal(false)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Database Backup Modal */}
      {currentUser && showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 transition-all duration-300 scale-100">
            
            {/* Modal Header */}
            <div className="bg-blue-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-800 rounded-lg">
                  <Settings className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight">System Settings & Data Backup</h3>
                  <p className="text-[11px] text-blue-200 font-medium">Export, restore, or merge your system data</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setParsedAllocations([]);
                  setParsedFaculties([]);
                  setParseError(null);
                  setImportSuccessMsg(null);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                title="Close Modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-grow">
              
              {/* Export Panel */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Export System Database</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Download a full backup of all registered faculties and duty allocations as a single JSON file. Use this to secure your data offline or migrate it.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-white border border-slate-150 rounded-lg text-xs font-semibold text-slate-700">
                  <span>Current database content:</span>
                  <span className="font-bold text-indigo-700">
                    {allocations.length} Allocations &bull; {faculties.length} Faculties
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleExport}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <FileJson className="h-4 w-4" />
                  <span>Download Backup JSON</span>
                </button>
              </div>

              {/* Import Panel */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg shrink-0">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Import & Merge Backup</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Upload a previously exported backup file. New records will be seamlessly integrated. Existing duplicate allocations and duplicate faculty registrations are automatically identified and skipped to prevent clutter.
                    </p>
                  </div>
                </div>

                {/* Drag and Drop File Input Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all ${
                    dragActive
                      ? "border-orange-500 bg-orange-50/40"
                      : "border-slate-300 bg-white hover:bg-slate-50/50 hover:border-indigo-400"
                  }`}
                >
                  <Upload className="h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700 text-center">
                    Drag and drop your backup JSON file here, or
                  </p>
                  <label className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors border border-slate-200">
                    Browse File
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                  </label>
                </div>

                {/* Validation status output */}
                {parseError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 text-red-800 rounded-lg text-xs font-medium border border-red-200">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{parseError}</span>
                  </div>
                )}

                {importSuccessMsg && (
                  <div className="flex items-start gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{importSuccessMsg}</span>
                  </div>
                )}

                {(parsedAllocations.length > 0 || parsedFaculties.length > 0) && (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-900">
                      <p className="font-extrabold flex items-center gap-1.5 mb-1 text-indigo-950">
                        <CheckCircle className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Ready to Import Backup</span>
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] mt-1 text-indigo-850 font-medium pl-1">
                        <li>Detected <strong>{parsedAllocations.length}</strong> exam allocations</li>
                        <li>Detected <strong>{parsedFaculties.length}</strong> registered faculties</li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={handleImportMerge}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Merging Data...</span>
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4" />
                          <span>Merge into Live Database</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-4 border-t border-slate-150 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setParsedAllocations([]);
                  setParsedFaculties([]);
                  setParseError(null);
                  setImportSuccessMsg(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Settings
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
