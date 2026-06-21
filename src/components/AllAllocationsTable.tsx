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
  FileSpreadsheet
} from 'lucide-react';
import { ExamAllocation } from '../types';
import { formatDisplayDate, formatTimestamp } from '../utils';

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
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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

    if (typeof valA === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return sortOrder === 'asc' ? valA - valB : valB - valA;
  });

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

        {/* Overflow Scrollable View */}
        <div className="overflow-x-auto">
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
                
                <th 
                  className="py-4 px-6 cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  Created At {getSortIcon('createdAt')}
                </th>
                
                {isAdmin && <th className="py-4 px-6 text-center w-28 select-none">Actions</th>}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="text-center py-12 text-slate-400 font-medium">
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
                      className={`hover:bg-blue-50/50 transition-colors duration-150 group ${isEven ? 'bg-gray-50/30' : ''}`}
                    >
                      <td className="py-3.5 px-6 font-semibold text-xs text-slate-400 text-center">
                        {String(slNo).padStart(2, '0')}
                      </td>
                      
                      <td className="py-3.5 px-6 font-bold text-slate-850">
                        {item.facultyName}
                      </td>
                      
                      <td className="py-3.5 px-6">
                        <span className="inline-block px-2.5 py-1 text-[10px] font-bold text-blue-900 bg-blue-50 rounded uppercase tracking-wider">
                          {item.department}
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
                      
                      <td className="py-3.5 px-6 text-xs text-slate-500 font-medium">
                        {formatTimestamp(item.createdAt)}
                      </td>
                      
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
