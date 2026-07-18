import React, { useState } from 'react';
import { 
  Trash2, 
  Edit3, 
  ChevronDown, 
  ChevronUp, 
  ChevronsLeft, 
  ChevronsRight, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { ExamAllocation } from '../types';
import { formatDisplayDate, formatTimestamp } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AllAllocationsTableProps {
  allocations: ExamAllocation[];
  onEdit: (record: ExamAllocation) => void;
  onDelete: (id: string) => Promise<void>;
  searchQuery: string;
  isAdmin?: boolean;
}

type SortField = 'facultyName' | 'department' | 'date' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function AllAllocationsTable({ allocations, onEdit, onDelete, searchQuery, isAdmin = false }: AllAllocationsTableProps) {
  // Sorting state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter records based on top search bar
  const filtered = allocations.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.facultyName.toLowerCase().includes(q) ||
      item.department.toLowerCase().includes(q)
    );
  });

  // Sort records
  const sorted = [...filtered].sort((a, b) => {
    let valA: any = a[sortField] || '';
    let valB: any = b[sortField] || '';

    // Handle FireStore timestamp nested comparison
    if (sortField === 'createdAt') {
      const timeA = typeof a.createdAt === 'object' && a.createdAt && 'seconds' in a.createdAt
        ? a.createdAt.seconds
        : Number(a.createdAt || 0);

      const timeB = typeof b.createdAt === 'object' && b.createdAt && 'seconds' in b.createdAt
        ? b.createdAt.seconds
        : Number(b.createdAt || 0);

      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    }

    if (sortField === 'date') {
      const dateA = a.date || '';
      const dateB = b.date || '';
      
      if (dateA !== dateB) {
        return sortOrder === 'asc'
          ? dateA.localeCompare(dateB)
          : dateB.localeCompare(dateA);
      }
      
      const getSessionPriority = (s: string) => {
        if (!s) return 4;
        const val = s.toLowerCase().trim();
        if (val === 'forenoon' || val === 'fn') return 1;
        if (val === 'afternoon' || val === 'an') return 2;
        if (val === 'full day' || val === 'fullday') return 3;
        return 4;
      };
      
      const priorityA = getSessionPriority(a.session);
      const priorityB = getSessionPriority(b.session);
      
      return sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
    }

    if (typeof valA === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

  // Highlight search text helper
  const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || !query.trim()) return text;
    const cleanQuery = query.trim();
    // Escape regex characters
    const escapedQuery = cleanQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === cleanQuery.toLowerCase() ? (
            <mark key={i} className="bg-yellow-250 text-yellow-950 font-extrabold px-0.5 rounded shadow-sm">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Calculate pages
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Adjust page if it exceeds maximum allowable pages
  const activePage = currentPage > totalPages ? totalPages : currentPage;
  
  const startIndex = (activePage - 1) * pageSize;
  const paginatedData = sorted.slice(startIndex, startIndex + pageSize);

  // Toggle sorting logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleDeleteTrigger = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteConfirmId);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4 text-orange-500 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 text-orange-500 inline ml-1" />
    );
  };

  // Export all allocations to PDF with identical College Header design
  const downloadAllPDF = () => {
    if (sorted.length === 0) return;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Colors
      const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
      const accentColor: [number, number, number] = [249, 115, 22]; // Orange 500

      // Margins
      const margin = 14;
      let currentY = 15;

      // 1. College Header (Exact copy of FacultyReport's College Header)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text("HKE Society's", doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
      
      currentY += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Sir M. Visvesvaraya College of Engineering, Raichur', doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });

      currentY += 7;
      doc.setFontSize(12);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text('Exam Duty Allocation 2026', doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });

      // Line spacer
      currentY += 4;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY, doc.internal.pageSize.getWidth() - margin, currentY);

      // 2. Report Metadata
      currentY += 12;
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'bold');
      doc.text('Report Type:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text('Consolidated Exam Duty Allocation List', margin + 28, currentY);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Duties:', 130, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(sorted.length), 130 + 26, currentY);

      currentY += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('Generated Date:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }), margin + 33, currentY);

      currentY += 10;

      // 3. Table Headers and Rows
      const tableColumn = ['Serial Number', 'Faculty Name', 'Department', 'Exam Date', 'Session'];
      const tableRows = sorted.map((alloc, idx) => [
        idx + 1,
        alloc.facultyName,
        alloc.department,
        formatDisplayDate(alloc.date),
        alloc.session
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [tableColumn],
        body: tableRows,
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [50, 50, 50],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 25 },
        }
      });

      // Add footers with page numbers to all pages (second pass)
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        
        const pageStr = `Page ${i} of ${totalPages}`;
        doc.text(pageStr, doc.internal.pageSize.getWidth() - margin - 15, doc.internal.pageSize.getHeight() - 10);
        doc.text('Generated by Exam Duty Allocation System', margin, doc.internal.pageSize.getHeight() - 10);
      }

      // Save PDF locally
      const fileName = `Consolidated_Exam_Duty_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Table Card wrapper */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
        
        {/* Table Subheader Info with Geometric Balance alignment */}
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
          <div className="flex items-center">
            <span className="w-2 h-6 bg-orange-500 rounded mr-3 inline-block"></span>
            <div>
              <h4 className="font-bold text-slate-800 text-base lg:text-lg">
                Recent Allocations
              </h4>
              <p className="text-[11px] text-slate-400 font-semibold tracking-wide">
                Showing {totalItems === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + pageSize, totalItems)} of {totalItems} entries
                {searchQuery && ` (filtered from ${allocations.length})`}
              </p>
            </div>
          </div>
          
          {/* Actions & Page size container */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Download All PDF Button */}
            <button
              onClick={downloadAllPDF}
              disabled={sorted.length === 0}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-400 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer select-none border border-red-700 disabled:shadow-none active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed"
              title="Download all allocations to PDF file"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            {/* Page size dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Rows per page:</span>
              <select
                className="bg-white border-2 border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-bold focus:outline-none focus:border-blue-900"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {[5, 10, 25, 50].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Responsive Content: Desktop Table & Mobile Stacked Cards */}
        {/* Desktop View (Medium and up screens) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            {/* Sticky Table Header */}
            <thead>
              <tr className="bg-gray-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider sticky top-0 z-10 border-b border-gray-100">
                <th className="py-4 px-6 w-16 text-center select-none">S.N.</th>
                
                <th 
                  className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                  onClick={() => handleSort('facultyName')}
                >
                  Faculty Name {getSortIcon('facultyName')}
                </th>
                
                <th 
                  className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                  onClick={() => handleSort('department')}
                >
                  Dept {getSortIcon('department')}
                </th>
                
                <th 
                  className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                  onClick={() => handleSort('date')}
                >
                  Date {getSortIcon('date')}
                </th>
                
                <th className="py-4 px-6 select-none">Session</th>
                
                {isAdmin && (
                  <th 
                    className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    Created At {getSortIcon('createdAt')}
                  </th>
                )}
                
                {isAdmin && <th className="py-4 px-6 text-center w-28 select-none">Actions</th>}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 5} className="text-center py-12 text-slate-400 font-medium">
                    {searchQuery ? 'No matching allocations found for your search.' : 'No duty allocations logged yet.'}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, index) => {
                  const slNo = startIndex + index + 1;
                  const isEven = index % 2 === 1;
                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors duration-150 group ${
                        item.isAdjusted 
                          ? 'bg-red-50/90 hover:bg-red-100/90 text-red-950' 
                          : isEven 
                            ? 'bg-gray-50/30 hover:bg-blue-50/50' 
                            : 'hover:bg-blue-50/50'
                      }`}
                    >
                      <td className="py-3.5 px-6 font-semibold text-xs text-slate-400 text-center">
                        {String(slNo).padStart(2, '0')}
                      </td>
                      
                      <td className="py-3.5 px-6 font-bold text-slate-850">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{highlightText(item.facultyName, searchQuery)}</span>
                          {item.isAdjusted && (
                            <span 
                              className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider"
                              title={item.adjustedFrom ? `Reassigned from ${item.adjustedFrom}` : 'Emergency duty reassignment'}
                            >
                              Adjusted
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="py-3.5 px-6">
                        <span className="inline-block px-2.5 py-1 text-[10px] font-bold text-blue-900 bg-blue-50 rounded uppercase tracking-wider">
                          {highlightText(item.department, searchQuery)}
                        </span>
                      </td>
                      
                      <td className="py-3.5 px-6 font-semibold text-slate-700 text-sm">
                        {formatDisplayDate(item.date)}
                      </td>
                      
                      <td className="py-3.5 px-6">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          item.session === 'Forenoon' ? 'bg-indigo-50 text-indigo-700' :
                          item.session === 'Afternoon' ? 'bg-amber-50 text-amber-700 font-extrabold' :
                          'bg-emerald-50 text-emerald-700 font-extrabold'
                        }`}>
                          {item.session}
                        </span>
                      </td>
                      
                      {isAdmin && (
                        <td className="py-3.5 px-6 text-xs text-slate-500 font-medium">
                          {formatTimestamp(item.createdAt)}
                        </td>
                      )}
                      
                      {isAdmin && (
                        <td className="py-3.5 px-6 text-center">
                          <div className="flex justify-center items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            {/* Edit Trigger */}
                            <button
                              onClick={() => onEdit(item)}
                              title="Edit Allocation"
                              className="p-1 px-2.5 rounded border border-gray-200 text-blue-700 hover:bg-blue-50 text-xs font-bold uppercase tracking-tight"
                            >
                              Edit
                            </button>
                            
                            {/* Delete Trigger */}
                            <button
                              onClick={() => handleDeleteTrigger(item.id)}
                              title="Delete Allocation"
                              className="p-1 px-2.5 rounded border border-gray-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-tight"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Card List for Mobile Screens) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {paginatedData.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-medium px-4 bg-white">
              {searchQuery ? 'No matching allocations found for your search.' : 'No duty allocations logged yet.'}
            </div>
          ) : (
            paginatedData.map((item, index) => {
              const slNo = startIndex + index + 1;
              const isEven = index % 2 === 1;
              return (
                <div 
                  key={item.id} 
                  className={`p-4 transition-colors duration-150 space-y-2.5 ${
                    item.isAdjusted 
                      ? 'bg-red-50/90 text-red-950 border-l-4 border-l-red-500' 
                      : isEven 
                        ? 'bg-gray-50/30' 
                        : 'bg-white'
                  }`}
                >
                  {/* Top line: Serial #, Session Badge, and Adjusted status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-150/60 px-1.5 py-0.5 rounded">
                        #{String(slNo).padStart(2, '0')}
                      </span>
                      {item.isAdjusted && (
                        <span 
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider"
                          title={item.adjustedFrom ? `Reassigned from ${item.adjustedFrom}` : 'Emergency duty reassignment'}
                        >
                          Adjusted
                        </span>
                      )}
                    </div>
                    
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                      item.session === 'Forenoon' ? 'bg-indigo-50 text-indigo-700' :
                      item.session === 'Afternoon' ? 'bg-amber-50 text-amber-700 font-extrabold' :
                      'bg-emerald-50 text-emerald-700 font-extrabold'
                    }`}>
                      {item.session}
                    </span>
                  </div>

                  {/* Faculty & department Details */}
                  <div className="space-y-1">
                    <h5 className="font-extrabold text-slate-800 text-sm leading-tight">
                      {highlightText(item.facultyName, searchQuery)}
                    </h5>
                    
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span className="inline-block px-2 py-0.5 text-[9px] font-bold text-blue-900 bg-blue-50 rounded uppercase tracking-wider">
                        {highlightText(item.department, searchQuery)}
                      </span>
                      <span className="text-slate-300 font-normal">&bull;</span>
                      <span className="font-semibold text-slate-700 text-[11px]">
                        {formatDisplayDate(item.date)}
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="text-[10px] text-slate-400 font-medium pt-0.5">
                        Added: {formatTimestamp(item.createdAt)}
                      </div>
                    )}
                  </div>

                  {/* Actions (if admin) */}
                  {isAdmin && (
                    <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => onEdit(item)}
                        className="px-2.5 py-1 rounded border border-gray-200 text-blue-750 bg-white hover:bg-blue-50 text-[11px] font-bold uppercase tracking-tight active:scale-[0.98]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTrigger(item.id)}
                        className="px-2.5 py-1 rounded border border-gray-200 text-red-650 bg-white hover:bg-red-50 text-[11px] font-bold uppercase tracking-tight active:scale-[0.98]"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400 font-bold uppercase">
              Showing {paginatedData.length} of {totalItems} Allocations
            </span>

            {/* Nav controls */}
            <div className="flex items-center gap-1">
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(1)}
                className="w-8 h-8 rounded border border-gray-200 bg-white text-gray-500 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title="First Page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
              
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded border border-gray-200 bg-white text-gray-500 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - activePage) <= 1 || p === 1 || p === totalPages)
                  .map((p, idx, arr) => {
                    const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span className="text-slate-400 px-1 text-xs">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 text-xs font-bold rounded border transition-all flex items-center justify-center ${
                            activePage === p 
                              ? 'bg-blue-900 border-blue-900 text-white shadow-sm' 
                              : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="w-8 h-8 rounded border border-gray-200 bg-white text-gray-500 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="w-8 h-8 rounded border border-gray-200 bg-white text-gray-500 hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                title="Last Page"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-500 flex-shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-lg">Confirm Deletion</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Are you absolutely sure you want to remove this exam duty allocation? This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all cursor-pointer border border-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              
              <button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 transition-all rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:scale-100"
              >
                {isDeleting ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
