import React, { useState } from 'react';
import { 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  Calendar, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  FileText, 
  RefreshCw, 
  Play, 
  Plus, 
  Info,
  Download
} from 'lucide-react';
import { ExamAllocation, Faculty, Department, Session } from '../types';
import { addAllocation, addFaculty } from '../firebase';

interface AutoAllocationProps {
  allocations: ExamAllocation[];
  faculties: Faculty[];
  showToast: (text: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess: () => void;
}

export function AutoAllocation({ allocations, faculties, showToast, onSuccess }: AutoAllocationProps) {
  const [allocationMode, setAllocationMode] = useState<'smart' | 'direct'>('smart');
  const [dragActive, setDragActive] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Parsing & direct upload state
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Smart allocation config states
  const [smartDateConfigs, setSmartDateConfigs] = useState<{ date: string; sessions: Session[] }[]>([
    { date: '', sessions: ['Forenoon'] }
  ]);
  const [maxDutiesPerFaculty, setMaxDutiesPerFaculty] = useState<number>(2);
  const [avoidConsecutiveDays, setAvoidConsecutiveDays] = useState<boolean>(true);
  const [previewSmartAllocations, setPreviewSmartAllocations] = useState<Omit<ExamAllocation, 'id' | 'createdAt'>[]>([]);

  const DEPARTMENTS: Department[] = [
    'CSE', 'ECE', 'Mechanical', 'Civil', 'AIML', 'MBA', 
    'Mathematics', 'Physics', 'Chemistry', 'Humanities', 'Others'
  ];

  const SESSIONS: Session[] = ['Forenoon', 'Afternoon', 'Full Day'];

  // Copy CSV format template to clipboard
  const handleCopyFormat = (formatId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(formatId);
    setTimeout(() => setCopiedFormat(null), 2000);
    showToast("Template copied to clipboard!", "success");
  };

  // Download CSV template populated with registered faculties
  const handleDownloadCSVTemplate = () => {
    // Column headers exactly as shown in the template image
    const headers = "Faculty Name,Department,Date,Session,Phone";
    
    // Rows populated with registered faculties
    const rows = faculties.map(f => {
      // If name contains comma, wrap in double quotes
      const name = f.name.includes(',') ? `"${f.name}"` : f.name;
      const dept = f.department;
      const phone = f.phone || '';
      // Leave Date and Session columns blank so the user can fill them in
      return `${name},${dept},,,${phone}`;
    });

    // Fallback if no faculties are registered yet, provide example values
    if (rows.length === 0) {
      rows.push("Dr. Ramesh Kumar,CSE,2026-06-22,Forenoon,9876543210");
      rows.push("Prof. Sangeetha S.,ECE,2026-06-22,Afternoon,9988776655");
      rows.push("Dr. Anand Patil,Mechanical,2026-06-23,Full Day,");
    }

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Direct_Exam_Allocation_Template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Populated CSV Template downloaded successfully!", "success");
  };

  // DragnDrop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Simple CSV parser supporting double quotes and comma separation
  const parseCSVText = (text: string) => {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === '\r' || char === '\n') {
        if (inQuotes) {
          currentLine += char;
        } else {
          if (char === '\r' && nextChar === '\n') {
            i++; // skip \n
          }
          lines.push(currentLine);
          currentLine = '';
        }
      } else {
        currentLine += char;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.map(line => {
      const result: string[] = [];
      let currentVal = '';
      let escaped = false;

      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          escaped = !escaped;
        } else if (c === ',' && !escaped) {
          result.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += c;
        }
      }
      result.push(currentVal.trim());
      return result;
    });
  };

  const handleFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const parsed = parseCSVText(text);

      if (parsed.length < 2) {
        setParseErrors(["The CSV file seems to be empty or has only one row."]);
        return;
      }

      const headers = parsed[0].map(h => h.toLowerCase().trim().replace(/['"]+/g, ''));
      const dataRows = parsed.slice(1).filter(row => row.some(cell => cell !== ''));

      if (allocationMode === 'direct') {
        // Direct Allocation CSV: Expects Name, Department, Date, Session (Phone is optional)
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('faculty'));
        const deptIdx = headers.findIndex(h => h.includes('dept') || h.includes('department'));
        const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('day'));
        const sessionIdx = headers.findIndex(h => h.includes('session') || h.includes('time'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));

        if (nameIdx === -1 || deptIdx === -1 || dateIdx === -1 || sessionIdx === -1) {
          setParseErrors([
            `Headers mapping failed. Required headers: Name/Faculty, Department/Dept, Date/Day, Session.\nFound headers: [${headers.join(', ')}]`
          ]);
          return;
        }

        const validRows: any[] = [];
        const errors: string[] = [];

        dataRows.forEach((row, index) => {
          const rowNum = index + 2; // 1-based, header is 1
          if (row.length < 4) {
            errors.push(`Row ${rowNum}: Incomplete data columns.`);
            return;
          }

          const facultyName = row[nameIdx]?.replace(/['"]+/g, '').trim();
          let departmentRaw = row[deptIdx]?.replace(/['"]+/g, '').toUpperCase().trim();
          let dateRaw = row[dateIdx]?.replace(/['"]+/g, '').trim();
          let sessionRaw = row[sessionIdx]?.replace(/['"]+/g, '').trim();
          const phoneRaw = phoneIdx !== -1 ? row[phoneIdx]?.replace(/['"]+/g, '').trim() : '';

          // Normalize Department
          let department: Department = 'Others';
          const matchedDept = DEPARTMENTS.find(d => d.toUpperCase() === departmentRaw);
          if (matchedDept) {
            department = matchedDept;
          } else {
            // Check short codes or partial match
            const partial = DEPARTMENTS.find(d => departmentRaw.includes(d.toUpperCase()));
            if (partial) {
              department = partial;
            } else if (departmentRaw === 'CS' || departmentRaw === 'C.S.E') {
              department = 'CSE';
            } else if (departmentRaw === 'EC' || departmentRaw === 'E.C.E') {
              department = 'ECE';
            } else if (departmentRaw === 'MECH' || departmentRaw === 'ME') {
              department = 'Mechanical';
            } else if (departmentRaw === 'CIVIL' || departmentRaw === 'CE') {
              department = 'Civil';
            } else if (departmentRaw === 'AI' || departmentRaw === 'AI&ML') {
              department = 'AIML';
            } else if (departmentRaw === 'MATH' || departmentRaw === 'MATHS') {
              department = 'Mathematics';
            } else {
              department = 'Others';
            }
          }

          // Validate or parse Date
          // Supports YYYY-MM-DD or DD-MM-YYYY or MM/DD/YYYY
          let dateStr = dateRaw;
          if (dateRaw.includes('/')) {
            const parts = dateRaw.split('/');
            if (parts.length === 3) {
              // assume MM/DD/YYYY or DD/MM/YYYY. We look for a 4 digit year
              let y = parts[2];
              let m = parts[0];
              let d = parts[1];
              if (y.length === 4) {
                // let's format safely
                if (parseInt(m) > 12) { // must be DD/MM/YYYY
                  const tmp = m; m = d; d = tmp;
                }
                dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
              }
            }
          } else if (dateRaw.includes('-')) {
            const parts = dateRaw.split('-');
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else if (parts[2].length === 4) {
                // DD-MM-YYYY
                dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          // Validate date string format
          const dateTest = new Date(dateStr);
          if (isNaN(dateTest.getTime())) {
            errors.push(`Row ${rowNum}: Invalid Date format (${dateRaw}). Please use YYYY-MM-DD.`);
            return;
          }

          // Normalize Session
          let session: Session = 'Forenoon';
          const sessionLower = sessionRaw.toLowerCase();
          if (sessionLower.includes('after') || sessionLower.includes('an') || sessionLower.includes('pm')) {
            session = 'Afternoon';
          } else if (sessionLower.includes('full') || sessionLower.includes('both') || sessionLower.includes('fd')) {
            session = 'Full Day';
          }

          if (!facultyName) {
            errors.push(`Row ${rowNum}: Faculty name is missing.`);
            return;
          }

          // Check for conflicts in the existing allocations array
          const dbConflict = allocations.some(a => 
            a.facultyName.toLowerCase() === facultyName.toLowerCase() &&
            a.date === dateStr &&
            a.session === session
          );

          // Check if already in the rows uploaded to avoid double listing in same batch
          const batchConflict = validRows.some(r => 
            r.facultyName.toLowerCase() === facultyName.toLowerCase() &&
            r.date === dateStr &&
            r.session === session
          );

          validRows.push({
            facultyName,
            department,
            date: dateStr,
            session,
            phone: phoneRaw,
            conflict: dbConflict || batchConflict,
            conflictReason: dbConflict ? 'Exists in current system' : batchConflict ? 'Duplicate in this CSV batch' : ''
          });
        });

        setParsedRows(validRows);
        setParseErrors(errors);
        
        if (validRows.length > 0) {
          showToast(`Successfully parsed ${validRows.length} allocation rows!`, "success");
        } else if (errors.length > 0) {
          showToast("Failed to parse valid rows. Please check CSV format errors.", "error");
        }
      } else {
        // Smart Allocation Upload Faculty details only: Expects Name, Department (Phone is optional)
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('faculty'));
        const deptIdx = headers.findIndex(h => h.includes('dept') || h.includes('department'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));

        if (nameIdx === -1 || deptIdx === -1) {
          setParseErrors([
            `Headers mapping failed. Required headers: Name/Faculty, Department/Dept.\nFound headers: [${headers.join(', ')}]`
          ]);
          return;
        }

        const validFacultyList: Omit<Faculty, 'id' | 'createdAt'>[] = [];
        const errors: string[] = [];

        dataRows.forEach((row, index) => {
          const rowNum = index + 2;
          const name = row[nameIdx]?.replace(/['"]+/g, '').trim();
          let deptRaw = row[deptIdx]?.replace(/['"]+/g, '').toUpperCase().trim();
          const phone = phoneIdx !== -1 ? row[phoneIdx]?.replace(/['"]+/g, '').trim() : '';

          if (!name) {
            errors.push(`Row ${rowNum}: Faculty name is missing.`);
            return;
          }

          // Normalize dept
          let department: Department = 'Others';
          const matchedDept = DEPARTMENTS.find(d => d.toUpperCase() === deptRaw);
          if (matchedDept) {
            department = matchedDept;
          } else {
            const partial = DEPARTMENTS.find(d => deptRaw.includes(d.toUpperCase()));
            if (partial) {
              department = partial;
            }
          }

          validFacultyList.push({ name, department, phone });
        });

        setParsedRows(validFacultyList);
        setParseErrors(errors);

        if (validFacultyList.length > 0) {
          showToast(`Loaded ${validFacultyList.length} faculty members for duty distribution simulation!`, "success");
        } else if (errors.length > 0) {
          showToast("Failed to compile faculty list. Review error log below.", "error");
        }
      }
    };
    reader.readAsText(file);
  };

  // SMART AUTO-ALLOCATION COMPUTATION ALGORITHM
  // Fair distribution algorithm with rules
  const runSmartAllocationAlgorithm = () => {
    // 1. Gather pool of faculties (either parsed CSV list, or current system registry)
    const pool: { name: string; department: Department; phone?: string; currentDutyCount: number; lastAssignedDate?: string }[] = [];

    if (parsedRows.length > 0 && allocationMode === 'smart') {
      // Use parsed CSV faculties
      parsedRows.forEach((f: any) => {
        // Count how many duties they already have in the system
        const currentCount = allocations.filter(a => a.facultyName.toLowerCase() === f.name.toLowerCase()).length;
        pool.push({
          name: f.name,
          department: f.department,
          phone: f.phone,
          currentDutyCount: currentCount,
        });
      });
    } else {
      // Use current faculties registered in database
      if (faculties.length === 0) {
        showToast("No faculties available. Please register faculty members first or upload a faculty list CSV.", "error");
        return;
      }
      faculties.forEach(f => {
        const currentCount = allocations.filter(a => a.facultyName.toLowerCase() === f.name.toLowerCase()).length;
        pool.push({
          name: f.name,
          department: f.department,
          phone: f.phone || '',
          currentDutyCount: currentCount,
        });
      });
    }

    // 2. Validate clean dates
    const validConfigs = smartDateConfigs.filter(cfg => cfg.date.trim() !== '');
    if (validConfigs.length === 0) {
      showToast("Please enter or select at least one valid Date for duties.", "error");
      return;
    }

    // Double check date formats
    for (const cfg of validConfigs) {
      if (isNaN(new Date(cfg.date).getTime())) {
        showToast(`Invalid date format detected: "${cfg.date}". Use YYYY-MM-DD.`, "error");
        return;
      }
    }

    // 3. Setup assignment arrays
    const generatedAllocations: Omit<ExamAllocation, 'id' | 'createdAt'>[] = [];

    // Order configs logically by date to prevent consecutive blocks
    const sortedConfigs = [...validConfigs].sort((a, b) => a.date.localeCompare(b.date));

    // Iterate dates and sessions
    for (const cfg of sortedConfigs) {
      const date = cfg.date;
      for (const session of cfg.sessions) {
        // For each date + session combo, we need an invigilator/faculty
        // To distribute duties fairly, we sort our faculty pool by:
        // - Duty Count asc (who has fewest duties gets first priority)
        // - Random noise (to break ties randomly, avoiding alpha bias)
        // - Distance from last assignment (if avoidConsecutiveDays is true)

        // Filter out faculties who have a HARD physical collision on THIS specific slot (same date & session or Full Day overlap)
        const candidates = pool.filter(fac => {
          const facNameNormalized = fac.name.toLowerCase().trim();

          // 1. Exact session booking (Forenoon/Forenoon, Afternoon/Afternoon, Full Day/Full Day)
          const hasExactBooking = 
            allocations.some(a => a.facultyName.toLowerCase().trim() === facNameNormalized && a.date === date && a.session === session) ||
            generatedAllocations.some(a => a.facultyName && a.facultyName.toLowerCase().trim() === facNameNormalized && a.date === date && a.session === session);

          // 2. Full Day overlap (they are already booked Full Day, so they can't do Forenoon/Afternoon)
          const hasFullDayBooking = 
            allocations.some(a => a.facultyName.toLowerCase().trim() === facNameNormalized && a.date === date && a.session === 'Full Day') ||
            generatedAllocations.some(a => a.facultyName && a.facultyName.toLowerCase().trim() === facNameNormalized && a.date === date && a.session === 'Full Day');

          // 3. Trying to book Full Day when they are already booked on a part-day session
          const hasPartDayBooking = session === 'Full Day' && (
            allocations.some(a => a.facultyName.toLowerCase().trim() === facNameNormalized && a.date === date) ||
            generatedAllocations.some(a => a.facultyName && a.facultyName.toLowerCase().trim() === facNameNormalized && a.date === date)
          );

          return !(hasExactBooking || hasFullDayBooking || hasPartDayBooking);
        });

        if (candidates.length === 0) {
          // Pool of available choices has exhausted. Let's create an explicit unassigned slot and list diagnostic checks
          const logs: string[] = [];
          pool.forEach(f => {
            const fNameNorm = f.name.toLowerCase().trim();
            const exactBk = allocations.some(a => a.facultyName.toLowerCase().trim() === fNameNorm && a.date === date && a.session === session) ||
                            generatedAllocations.some(a => a.facultyName && a.facultyName.toLowerCase().trim() === fNameNorm && a.date === date && a.session === session);
            const fullBk = allocations.some(a => a.facultyName.toLowerCase().trim() === fNameNorm && a.date === date && a.session === 'Full Day') ||
                           generatedAllocations.some(a => a.facultyName && a.facultyName.toLowerCase().trim() === fNameNorm && a.date === date && a.session === 'Full Day');
            const partBk = session === 'Full Day' && (
              allocations.some(a => a.facultyName.toLowerCase().trim() === fNameNorm && a.date === date) ||
              generatedAllocations.some(a => a.facultyName && a.facultyName.toLowerCase().trim() === fNameNorm && a.date === date)
            );

            if (exactBk) {
              logs.push(`• ${f.name} already assigned to ${session} on this day`);
            } else if (fullBk) {
              logs.push(`• ${f.name} already assigned to Full Day on this day`);
            } else if (partBk) {
              logs.push(`• ${f.name} already assigned with part-day conflict`);
            } else {
              logs.push(`• ${f.name} excluded by schedule rules`);
            }
          });

          generatedAllocations.push({
            facultyName: 'Unassigned (No Available Faculty)',
            department: 'Others',
            date,
            session,
            isUnassigned: true,
            unassignedReason: pool.length === 0 ? 'Faculty pool is empty' : 'All available teachers have concurrent schedule conflicts for this date & session.',
            checkedLog: logs
          });

          showToast(`Warning: Could not allocate any faculty for ${date} (${session}) due to schedule rules.`, "warning");
          continue;
        }

        // Sort candidates to find the most eligible/fair one
        candidates.sort((a, b) => {
          // Priority 1: Prefer candidates who have NOT reached the duty limit
          const aAtLimit = a.currentDutyCount >= maxDutiesPerFaculty;
          const bAtLimit = b.currentDutyCount >= maxDutiesPerFaculty;
          if (aAtLimit !== bAtLimit) {
            return aAtLimit ? 1 : -1;
          }

          // Priority 2: Avoid same-day other-session assignment if possible (soft preference)
          const aHasOtherSessionToday = 
            allocations.some(al => al.facultyName.toLowerCase().trim() === a.name.toLowerCase().trim() && al.date === date) ||
            generatedAllocations.some(al => al.facultyName && al.facultyName.toLowerCase().trim() === a.name.toLowerCase().trim() && al.date === date);
          const bHasOtherSessionToday = 
            allocations.some(al => al.facultyName.toLowerCase().trim() === b.name.toLowerCase().trim() && al.date === date) ||
            generatedAllocations.some(al => al.facultyName && al.facultyName.toLowerCase().trim() === b.name.toLowerCase().trim() && al.date === date);
          if (aHasOtherSessionToday !== bHasOtherSessionToday) {
            return aHasOtherSessionToday ? 1 : -1;
          }

          // Priority 3: Avoid consecutive day order if configured
          if (avoidConsecutiveDays) {
            const aConsecutive = a.lastAssignedDate && Math.abs(new Date(date).getTime() - new Date(a.lastAssignedDate).getTime()) / (1000 * 3600 * 24) <= 1;
            const bConsecutive = b.lastAssignedDate && Math.abs(new Date(date).getTime() - new Date(b.lastAssignedDate).getTime()) / (1000 * 3600 * 24) <= 1;
            if (aConsecutive !== bConsecutive) {
              return aConsecutive ? 1 : -1;
            }
          }

          // Priority 4: Least duties count (fairness)
          if (a.currentDutyCount !== b.currentDutyCount) {
            return a.currentDutyCount - b.currentDutyCount;
          }

          // Priority 5: Randomized tie-break
          return Math.random() - 0.5;
        });

        // Pick the best match
        const assignedFac = candidates[0];
        
        // Push assignment
        generatedAllocations.push({
          facultyName: assignedFac.name,
          department: assignedFac.department,
          date,
          session,
        });

        // Update stats in runtime pool
        assignedFac.currentDutyCount += 1;
        assignedFac.lastAssignedDate = date;
      }
    }

    setPreviewSmartAllocations(generatedAllocations);
    if (generatedAllocations.length > 0) {
      showToast(`Smart simulation complete! Plotted ${generatedAllocations.length} duties across available faculties.`, "success");
    } else {
      showToast("No duties could be auto-assigned. Please verify dates or raise max duties limit.", "error");
    }
  };

  // BATCH SAVE TO FIREBASE/FALLBACK
  const handleCommitAllocations = async () => {
    const listToSave = allocationMode === 'direct' 
      ? parsedRows.filter(r => !r.conflict) // Skip conflicting rows or let user save non-conflicting?
      : previewSmartAllocations.filter(a => !a.isUnassigned);

    if (listToSave.length === 0) {
      showToast("No new records eligible to be committed.", "error");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: listToSave.length });

    // If direct mode, let's also auto-add faculty to register if they don't exist
    let addedFacsCount = 0;
    
    try {
      for (let i = 0; i < listToSave.length; i++) {
        const item = listToSave[i];

        // 1. If faculty doesn't exist in existing faculties registry, register them on the fly!
        const facultyExists = faculties.some(f => f.name.toLowerCase() === item.facultyName.toLowerCase());
        if (!facultyExists && allocationMode === 'direct') {
          try {
            await addFaculty({
              name: item.facultyName,
              department: item.department,
              phone: item.phone || ''
            });
            addedFacsCount++;
          } catch (faErr) {
            console.warn("Faculty register skip: ", faErr);
          }
        }

        // 2. Add Allocation
        await addAllocation({
          facultyName: item.facultyName,
          department: item.department,
          date: item.date,
          session: item.session
        });

        setUploadProgress(prev => ({ ...prev, current: i + 1 }));
      }

      let successMsg = `Successfully committed ${listToSave.length} exam allocations to system database.`;
      if (addedFacsCount > 0) {
        successMsg += ` Registered ${addedFacsCount} new faculty members.`;
      }
      showToast(successMsg, "success");

      // Reset
      setParsedRows([]);
      setPreviewSmartAllocations([]);
      onSuccess(); // Triggers re-sub of database state and tabs back to all.
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "Batch write suffered a structural interruption.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddDateInput = () => {
    setSmartDateConfigs([...smartDateConfigs, { date: '', sessions: ['Forenoon'] }]);
  };

  const handleRemoveDateInput = (idx: number) => {
    setSmartDateConfigs(smartDateConfigs.filter((_, i) => i !== idx));
  };

  const handleDateChange = (idx: number, val: string) => {
    const updated = [...smartDateConfigs];
    updated[idx].date = val;
    setSmartDateConfigs(updated);
  };

  const toggleSessionSelectionForDate = (idx: number, session: Session) => {
    const updated = [...smartDateConfigs];
    const currentSessions = updated[idx].sessions;
    if (currentSessions.includes(session)) {
      if (currentSessions.length > 1) {
        updated[idx].sessions = currentSessions.filter(s => s !== session);
      } else {
        showToast("Minimum of 1 session must remain selected for a date.", "warning");
      }
    } else {
      updated[idx].sessions = [...currentSessions, session];
    }
    setSmartDateConfigs(updated);
  };

  // Templates text code blocks
  const directTemplate = `Faculty Name,Department,Date,Session,Phone
Dr. Ramesh Kumar,CSE,2026-06-22,Forenoon,9876543210
Prof. Sangeetha S.,ECE,2026-06-22,Afternoon,9988776655
Dr. Anand Patil,Mechanical,2026-06-23,Full Day,`;

  const smartTemplate = `Faculty Name,Department,Phone
Prof. Anjali Sharma,CSE,9844002211
Mr. Arvind Rao,ECE,
Dr. S. K. Patil,Mechanical,9122334455`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4 sm:p-6 mb-8 max-w-4xl mx-auto">
      
      {/* Header and selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-5 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
            Automatic Faculty Duty Allocator
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Easily upload Excel/CSV sheets of staff details and dates, or let the smart scheduler allocate them evenly.
          </p>
        </div>

        {/* Selection Switcher */}
        <div className="bg-slate-100 rounded-xl p-1 flex self-start sm:self-center shrink-0 border border-slate-200/40">
          <button
            onClick={() => {
              setParsedRows([]);
              setParseErrors([]);
              setPreviewSmartAllocations([]);
              setAllocationMode('smart');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              allocationMode === 'smart' 
                ? 'bg-blue-900 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Smart Auto-Allocator
          </button>
          
          <button
            onClick={() => {
              setParsedRows([]);
              setParseErrors([]);
              setPreviewSmartAllocations([]);
              setAllocationMode('direct');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              allocationMode === 'direct' 
                ? 'bg-blue-900 text-white shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Direct CSV Upload
          </button>
        </div>
      </div>

      {isUploading ? (
        <div className="py-12 text-center space-y-4 max-w-md mx-auto">
          <div className="h-10 w-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <h3 className="text-sm font-black text-slate-800">Committing batch allocations...</h3>
          <p className="text-xs text-slate-500">Writing records and auditing faculty rosters safely into database.</p>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
            <div 
              className="bg-indigo-600 h-2.5 transition-all duration-300"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
          <div className="text-xs font-mono font-bold text-indigo-600">
            {uploadProgress.current} / {uploadProgress.total} Saved
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* INSTRUCTIONS ACCORDION BOX */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/50">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-900 mt-0.5 shrink-0" />
              <div className="flex-grow space-y-2">
                <span className="text-xs font-extrabold text-blue-950 block uppercase tracking-wider">
                  {allocationMode === 'smart' ? 'SMART ALGORITHM CSV TEMPLATE' : 'DIRECT EXAM ALLOCATION CSV TEMPLATE'}
                </span>
                
                <p className="text-xs text-slate-600 leading-relaxed">
                  {allocationMode === 'smart' 
                    ? 'Use this template to import a roster of teachers. The system will evenly distribute exam duty slots across dates for you!' 
                    : 'Use this template to directly import ready allocations. The system parsed and writes dates and sessions exactly.'}
                </p>

                {/* CSV Format preview */}
                <div className="relative mt-2">
                  <pre className="p-3 bg-slate-900/95 font-mono text-[10px] text-emerald-400 rounded-xl overflow-x-auto shadow-inner select-all leading-relaxed border border-slate-800">
                    {allocationMode === 'smart' ? smartTemplate : directTemplate}
                  </pre>
                  
                  <button
                    onClick={() => handleCopyFormat(
                      allocationMode, 
                      allocationMode === 'smart' ? smartTemplate : directTemplate
                    )}
                    className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all border border-slate-700 cursor-pointer"
                    title="Copy format"
                  >
                    {copiedFormat === allocationMode ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>

                {allocationMode === 'direct' && (
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-100 p-3 rounded-xl border border-slate-200/50">
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium leading-tight">
                      We can pre-populate this CSV template with all {faculties.length} registered faculty names and departments for your convenience.
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadCSVTemplate}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer select-none active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Populated Template</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MODE 1: SMART AUTO ALLOCATION WIZARD */}
          {allocationMode === 'smart' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Form Config Left */}
              <div className="space-y-5 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wide border-b border-slate-100 pb-2">
                  Parameters & Inputs
                </span>

                {/* 1. Scheduled Exam Dates & Sessions */}
                <div className="space-y-3">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    1. Scheduled Exam Dates & Sessions
                  </label>
                  
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {smartDateConfigs.map((config, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row gap-2 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                        <div className="flex-grow flex gap-2">
                          <input
                            type="date"
                            value={config.date}
                            onChange={(e) => handleDateChange(idx, e.target.value)}
                            className="w-full p-2 text-xs border border-slate-200 bg-white rounded-lg outline-none focus:border-indigo-500 font-semibold"
                          />
                          {smartDateConfigs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDateInput(idx)}
                              className="p-2 border border-slate-200 text-rose-500 hover:text-rose-600 bg-white hover:bg-rose-50 rounded-lg transition-all cursor-pointer sm:hidden"
                              title="Remove date"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        
                        {/* Session selector buttons for this date */}
                        <div className="flex items-center gap-1.5 justify-between sm:justify-start">
                          <div className="flex gap-1">
                            {SESSIONS.map((session) => {
                              const isSelected = config.sessions.includes(session);
                              return (
                                <button
                                  key={session}
                                  type="button"
                                  onClick={() => toggleSessionSelectionForDate(idx, session)}
                                  className={`px-2 py-1.5 font-bold text-[10px] rounded-lg transition-all border cursor-pointer select-none ${
                                    isSelected 
                                      ? 'bg-blue-900 border-blue-900 text-white' 
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                  }`}
                                  title={`${session} session for this date`}
                                >
                                  {session === 'Forenoon' ? 'FN' : session === 'Afternoon' ? 'AN' : 'FD'}
                                </button>
                              );
                            })}
                          </div>
                          
                          {smartDateConfigs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDateInput(idx)}
                              className="hidden sm:block p-2 border border-slate-200 text-rose-500 hover:text-rose-600 bg-white hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Remove date"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDateInput}
                    className="w-full py-1.5 border border-dashed border-indigo-400 font-bold text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50/20 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Date Row
                  </button>
                  
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    FN = Forenoon • AN = Afternoon • FD = Full Day. Toggle active sessions directly per day.
                  </span>
                </div>

                {/* 3. Duty caps and algorithm rules */}
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block mb-1">
                        Max Duties Cap
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={maxDutiesPerFaculty}
                        onChange={(e) => setMaxDutiesPerFaculty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full p-2 text-xs border border-slate-200 bg-white rounded-lg outline-none focus:border-indigo-500 font-semibold"
                      />
                      <span className="text-[10px] text-slate-400 mt-1 block">Maximum allocations allowed per teacher.</span>
                    </div>

                    <div className="flex flex-col justify-end">
                      <label className="flex items-center gap-2 text-xs font-extrabold text-slate-700 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={avoidConsecutiveDays}
                          onChange={(e) => setAvoidConsecutiveDays(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                        />
                        Avoid Back-to-Back
                      </label>
                      <span className="text-[10px] text-slate-400 mt-1 block">Prevent assigning faculty to consecutive days.</span>
                    </div>
                  </div>
                </div>

                {/* 4. Faculty Selection Options */}
                <div className="space-y-3 pt-2">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    3. Faculty Pool Input
                  </label>
                  
                  {parsedRows.length > 0 ? (
                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-800 text-xs border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle className="h-4 w-4" />
                        Using {parsedRows.length} Faculty from uploaded CSV
                      </div>
                      <button
                        type="button"
                        onClick={() => setParsedRows([])}
                        className="text-[10px] font-extrabold underline text-emerald-850 hover:text-slate-700 uppercase"
                      >
                        Reset Pool
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-[11px] text-slate-600 block leading-relaxed">
                        By default, the smart algorithm pulls from the <strong>{faculties.length} teachers</strong> in the Faculty Register list. Alternatively, upload a temporary roster sheet of teacher names below:
                      </span>
                      
                      {/* DRAG AND DROP ZONE */}
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                          dragActive 
                            ? 'border-indigo-600 bg-indigo-50/40 scale-[0.99]' 
                            : 'border-slate-200 hover:border-indigo-500 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleFileInputChange}
                          className="hidden"
                          id="csv-smart-input"
                        />
                        <label htmlFor="csv-smart-input" className="cursor-pointer">
                          <Users className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                          <span className="text-xs font-bold text-indigo-600 block">Upload custom roster list (.csv)</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Drag & drop or Click to choose</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Run Trigger Button */}
                <button
                  type="button"
                  onClick={runSmartAllocationAlgorithm}
                  className="w-full py-2.5 bg-blue-900 hover:bg-blue-955 text-white font-extrabold text-xs shadow-md rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <Play className="h-4 w-4" />
                  Generate Automated Fair Schedule
                </button>

              </div>

              {/* Preview Smart Calculations Right */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden self-stretch flex flex-col h-[500px]">
                <div className="bg-slate-50 border-b border-slate-200/80 p-3 flex justify-between items-center">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-900" />
                    Auto-Placement Scheme Preview
                  </span>
                  
                  {previewSmartAllocations.length > 0 && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-black">
                      {previewSmartAllocations.length} Proposals
                    </span>
                  )}
                </div>

                {previewSmartAllocations.length > 0 ? (
                  <div className="flex-grow flex flex-col justify-between overflow-hidden">
                    <div className="overflow-y-auto flex-grow p-4 space-y-2">
                      {previewSmartAllocations.map((item, index) => {
                        if (item.isUnassigned) {
                          return (
                            <div 
                              key={index}
                              className="p-3 bg-amber-50/40 border border-amber-200 rounded-xl shadow-xs text-xs space-y-2 transition-all duration-150"
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-0.5">
                                  <span className="font-black text-rose-705 flex items-center gap-1.5 text-[11px]">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-550 shrink-0" />
                                    Unassigned Slot
                                  </span>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold">
                                    <span>{item.session} Session</span>
                                  </div>
                                </div>
                                
                                <div className="text-amber-850 font-mono text-[10px] font-bold bg-amber-100 px-2 py-1 rounded-md shrink-0 block">
                                  {item.date}
                                </div>
                              </div>

                              <p className="text-[10px] text-amber-900 leading-relaxed font-medium bg-amber-50/70 p-2 rounded-lg border border-amber-100/50">
                                {item.unassignedReason}
                              </p>

                              {item.checkedLog && item.checkedLog.length > 0 && (
                                <div className="p-2.5 bg-white rounded-lg border border-slate-100 space-y-1">
                                  <span className="text-[9px] font-black tracking-wider uppercase text-slate-400 block">CONFLICT CHECKS DIARY:</span>
                                  <div className="space-y-1 leading-normal">
                                    {item.checkedLog.map((log, lIdx) => (
                                      <div key={lIdx} className="text-[9px] font-mono text-slate-500 font-medium">{log}</div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div 
                            key={index} 
                            className="p-3 bg-white border border-slate-200/50 hover:bg-slate-50 rounded-xl shadow-xs flex items-center justify-between text-xs transition-all duration-150"
                          >
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800">{item.facultyName}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span className="font-black text-rose-500 font-mono tracking-wider">{item.department}</span>
                                <span>•</span>
                                <span>{item.session}</span>
                              </div>
                            </div>
                            
                            <div className="text-slate-600 font-mono text-[10px] font-bold bg-slate-100 px-2 py-1 rounded-md shrink-0 block">
                              {item.date}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Commit Box footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
                      <div className="text-xs text-slate-500">
                        Preview correct? Save coordinates into live duty rosters.
                      </div>
                      <button
                        type="button"
                        onClick={handleCommitAllocations}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Commit Schedule
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col justify-center items-center text-center p-8 bg-slate-100/30">
                    <Calendar className="h-10 w-10 text-slate-300 animate-pulse mb-2" />
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase">Proposal Board Empty</h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mt-1 leading-relaxed">
                      Select target exam dates, customize cap counts, and click <strong>"Generate Automated Fair Schedule"</strong> to review proposals.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* MODE 2: DIRECT CSV ALLOCATIONS FILE IMPORT */}
          {allocationMode === 'direct' && (
            <div className="space-y-6">
              
              {/* FILE UPLOAD ZONE */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-3 border-dashed rounded-2xl p-8 py-12 text-center transition-all bg-slate-50/50 ${
                  dragActive 
                    ? 'border-indigo-600 bg-indigo-50/40 scale-[0.99]' 
                    : 'border-slate-200 hover:border-indigo-500 hover:bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="csv-file-input"
                />
                
                <label htmlFor="csv-file-input" className="cursor-pointer space-y-3 block">
                  <div className="p-3 bg-blue-50 text-blue-900 inline-flex rounded-2xl shadow-xs mx-auto border border-blue-100/80">
                    <Upload className="h-8 w-8 text-indigo-600" />
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-800">
                      Upload your compiled allocations CSV spreadsheet
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Drag & drop your CSV spreadsheet sheet here, or click to find the file from your computer local storage.
                    </p>
                  </div>

                  <span className="inline-flex px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all">
                    Browse CSV Sheet File
                  </span>
                </label>
              </div>

              {/* PARSED OUTPUTS VIEW */}
              {parsedRows.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-indigo-650" />
                      CSV Spreadsheet Row Parser Review ({parsedRows.length} Rows)
                    </h3>
                    
                    <button
                      type="button"
                      onClick={() => setParsedRows([])}
                      className="text-xs text-rose-500 hover:text-rose-700 underline font-semibold transition-all cursor-pointer"
                    >
                      Clear Loaded Sheet
                    </button>
                  </div>

                  {/* Errors and diagnostics */}
                  {parseErrors.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-1 max-h-32 overflow-y-auto">
                      <h4 className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        Pre-parsing Flagged Warnings ({parseErrors.length} Lines Affected):
                      </h4>
                      <ul className="list-disc pl-5 text-[10px] text-rose-700 font-mono leading-relaxed space-y-0.5">
                        {parseErrors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Main Grid table */}
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-extrabold tracking-widest text-[10px] uppercase border-b border-slate-250/20">
                            <th className="p-3 pl-4">#</th>
                            <th className="p-3">Faculty Name</th>
                            <th className="p-3">Department</th>
                            <th className="p-3">Allocated Date</th>
                            <th className="p-3">Daily Session</th>
                            <th className="p-3 text-right pr-4">Status / Audit check</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-medium">
                          {parsedRows.map((row, idx) => (
                            <tr 
                              key={idx} 
                              className={`hover:bg-slate-50 transition-all ${row.conflict ? 'bg-amber-50/40 text-amber-900 border-l-2 border-amber-500' : ''}`}
                            >
                              <td className="p-3 pl-4 font-bold text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-800">{row.facultyName}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-black uppercase font-mono border border-slate-200/40">{row.department}</span>
                              </td>
                              <td className="p-3 font-mono font-semibold text-slate-600">{row.date}</td>
                              <td className="p-3">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                  row.session === 'Forenoon' ? 'bg-blue-50 text-blue-800' :
                                  row.session === 'Afternoon' ? 'bg-indigo-50 text-indigo-850' : 'bg-pink-50 text-pink-850'
                                }`}>
                                  {row.session}
                                </span>
                              </td>
                              <td className="p-3 text-right pr-4 font-semibold text-[11px]">
                                {row.conflict ? (
                                  <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-100/60 px-2 py-0.5 rounded-md font-bold">
                                    <AlertTriangle className="h-3 w-3" />
                                    Skip: {row.conflictReason}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                                    <CheckCircle className="h-3 w-3" />
                                    Active Allocation
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200/60 rounded-xl gap-3">
                    <div className="text-xs text-slate-500">
                      <strong>Note:</strong> Rows flagged with skips will be omitted automatically to prevent double-booking conflicts. Any unregistered teachers will be registered in the register roster on the fly.
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCommitAllocations}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all self-end sm:self-center cursor-pointer uppercase tracking-wider shrink-0"
                    >
                      <Check className="h-4 w-4" />
                      Commit Saved Sheet Records ({parsedRows.filter(r => !r.conflict).length} rows)
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}
