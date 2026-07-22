import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Search, 
  Users, 
  GraduationCap, 
  UserPlus, 
  RotateCcw,
  Phone,
  Download,
  AlertTriangle
} from 'lucide-react';
import { Faculty, Department } from '../types';
import { addFaculty, updateFaculty, removeFaculty, subscribeToFaculties } from '../firebase';

interface FacultyRegistryProps {
  showToast: (text: string, type: 'success' | 'error') => void;
}

export function FacultyRegistry({ showToast }: FacultyRegistryProps) {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [name, setName] = useState('');
  const [department, setDepartment] = useState<Department>('CSE');
  const [phone, setPhone] = useState('');
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Departments list for dropdown selection
  const departments: Department[] = [
    'CSE', 'ECE', 'Mechanical', 'Civil', 'AIML', 'MBA', 
    'Mathematics', 'Physics', 'Chemistry', 'Humanities', 'Others'
  ];

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToFaculties((fetched) => {
      setFaculties(fetched);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Faculty name is required', 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (editingFaculty) {
        await updateFaculty(editingFaculty.id, {
          name: name.trim(),
          department,
          phone: phone.trim()
        });
        showToast('Faculty details updated successfully', 'success');
        setEditingFaculty(null);
      } else {
        await addFaculty({
          name: name.trim(),
          department,
          phone: phone.trim()
        });
        showToast('Faculty member registered successfully', 'success');
      }
      setName('');
      setDepartment('CSE');
      setPhone('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save faculty.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (faculty: Faculty) => {
    setEditingFaculty(faculty);
    setName(faculty.name);
    setDepartment(faculty.department);
    setPhone(faculty.phone || '');
  };

  const handleCancelEdit = () => {
    setEditingFaculty(null);
    setName('');
    setDepartment('CSE');
    setPhone('');
  };

  const handleDelete = (id: string, facultyName: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(facultyName);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await removeFaculty(deleteConfirmId);
      showToast('Faculty removed successfully', 'success');
      if (editingFaculty?.id === deleteConfirmId) {
        handleCancelEdit();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove faculty member.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
    }
  };

  // Filtered Registry List
  const filteredFaculties = faculties.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export to CSV function
  const exportToCSV = () => {
    if (faculties.length === 0) {
      showToast('No faculty records to export', 'error');
      return;
    }
    
    // Create CSV header
    const headers = ['Serial No', 'Full Name', 'Department', 'Phone Number'];
    
    // Map faculty data to rows, escaping quotes to keep the CSV format valid
    const rows = faculties.map((faculty, idx) => [
      idx + 1,
      `"${(faculty.name || '').replace(/"/g, '""')}"`,
      `"${(faculty.department || '').replace(/"/g, '""')}"`,
      `"${(faculty.phone || '').replace(/"/g, '""')}"`
    ]);
    
    // Combine header and rows with proper newlines
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');
    
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `faculty_directory_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Faculty directory exported to CSV successfully!', 'success');
    } catch (err: any) {
      showToast('Failed to export CSV: ' + (err?.message || err), 'error');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-fadeIn pb-12">
      {/* Form Section */}
      <div className="w-full lg:w-1/3 flex flex-col">
        <section className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 flex flex-col h-full">
          <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center">
            <span className="w-2 h-6 bg-orange-500 rounded mr-3"></span>
            {editingFaculty ? 'Modify Faculty details' : 'Register New Faculty'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-5 flex-1 select-none">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Faculty Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Ramesh Kumar"
                className="w-full p-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-900 outline-none transition-colors text-sm font-medium focus:ring-0 bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className="w-full p-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-900 outline-none transition-colors text-sm font-medium focus:ring-0 bg-white"
                disabled={isLoading}
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                Phone Number <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full p-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-900 outline-none transition-colors text-sm font-medium focus:ring-0 bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-400"
              >
                {editingFaculty ? (
                  <>
                    <Edit3 className="h-4.5 w-4.5" />
                    Update Details
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4.5 w-4.5" />
                    Register Faculty
                  </>
                )}
              </button>
              
              {(editingFaculty || name || phone) && (
                <button
                  type="button"
                  onClick={editingFaculty ? handleCancelEdit : () => { setName(''); setPhone(''); }}
                  className="px-5 py-3 border-2 border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      </div>

      {/* Directory Table Section */}
      <div className="w-full lg:w-2/3 flex flex-col">
        <section className="bg-white rounded-2xl shadow-md border border-gray-100 flex flex-col h-full overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center">
              <span className="w-2 h-6 bg-orange-500 rounded mr-3"></span>
              <div>
                <h3 className="text-lg font-bold text-gray-750">Campus Faculty Directory</h3>
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">
                  Registered: {faculties.length} members
                </p>
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              {/* CSV Export Button */}
              <button
                type="button"
                onClick={exportToCSV}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm hover:shadow transition-all cursor-pointer select-none border border-emerald-700 active:scale-[0.98]"
                title="Export all faculty members to CSV file"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              {/* Live Search inside directory */}
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Search faculty or dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-900 transition-all bg-white"
                />
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Directory Content */}
          <div className="flex-1 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-auto max-h-[450px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gray-50 z-20">
                  <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-4 w-16 text-center">S.N.</th>
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Phone Number</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredFaculties.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium text-sm">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <p>
                            {searchQuery 
                              ? 'No faculty matched your query description.' 
                              : 'No faculty members registered in directory. Use the register widget to add members.'}
                          </p>
                          {!searchQuery && (
                            <button
                              type="button"
                              onClick={async () => {
                                setIsLoading(true);
                                try {
                                  const sampleFaculties = [
                                    { name: "Dr. Ramesh Kumar", department: "CSE", phone: "9876543210" },
                                    { name: "Prof. Sangeetha S.", department: "ECE", phone: "9988776655" },
                                    { name: "Dr. Anand Patil", department: "Mechanical", phone: "9123456789" },
                                    { name: "Prof. K. Mahendra", department: "ECE", phone: "9876123450" },
                                    { name: "Dr. Seema Patil", department: "AIML", phone: "9567812340" },
                                    { name: "Prof. Rajesh Shastry", department: "Mechanical", phone: "9456712308" },
                                    { name: "Dr. Suresh G.", department: "Civil", phone: "9345671209" },
                                    { name: "Dr. Neha Deshpande", department: "MBA", phone: "9898765432" },
                                    { name: "Prof. Vikram Sen", department: "Mathematics", phone: "9765432109" },
                                    { name: "Dr. Asha Hegde", department: "Physics", phone: "9654321098" }
                                  ];
                                  for (const faculty of sampleFaculties) {
                                    await addFaculty(faculty as any);
                                  }
                                  showToast('Sample faculty members registered successfully!', 'success');
                                } catch (err: any) {
                                  showToast(err?.message || 'Failed to seed sample faculty members.', 'error');
                                } finally {
                                  setIsLoading(false);
                                }
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer select-none active:scale-95"
                            >
                              Seed Sample Faculty Data
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFaculties.map((faculty, idx) => {
                      const isEven = idx % 2 === 1;
                      return (
                        <tr 
                          key={faculty.id} 
                          className={`hover:bg-blue-50/50 transition-colors group ${isEven ? 'bg-gray-50/20' : ''}`}
                        >
                          <td className="px-6 py-3.5 text-xs font-semibold text-gray-400 text-center">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="px-6 py-3.5 text-sm font-bold text-gray-800">
                            {faculty.name}
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-600">
                            <span className="bg-blue-50 text-blue-900 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                              {faculty.department}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-sm text-gray-700">
                            {faculty.phone ? (
                              <span className="flex items-center gap-1.5 font-medium">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span className="font-mono text-xs">{faculty.phone}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 italic text-xs">Not specified</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <div className="flex justify-center items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleEdit(faculty)}
                                className="p-1 px-2.5 rounded border border-gray-200 text-blue-700 hover:bg-blue-50 text-xs font-bold uppercase tracking-tight cursor-pointer"
                                title="Edit Details"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(faculty.id, faculty.name)}
                                className="p-1 px-2.5 rounded border border-gray-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-tight cursor-pointer"
                                title="Delete Faculty"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (Card List for Mobile Screens) */}
            <div className="block md:hidden overflow-y-auto max-h-[450px] divide-y divide-slate-100">
              {filteredFaculties.length === 0 ? (
                <div className="p-6 text-center text-gray-400 font-medium text-sm">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <p>
                      {searchQuery 
                        ? 'No faculty matched your query description.' 
                        : 'No faculty members registered in directory. Use the register widget to add members.'}
                    </p>
                    {!searchQuery && (
                      <button
                        type="button"
                        onClick={async () => {
                          setIsLoading(true);
                          try {
                            const sampleFaculties = [
                              { name: "Dr. Ramesh Kumar", department: "CSE", phone: "9876543210" },
                              { name: "Prof. Sangeetha S.", department: "ECE", phone: "9988776655" },
                              { name: "Dr. Anand Patil", department: "Mechanical", phone: "9123456789" },
                              { name: "Prof. K. Mahendra", department: "ECE", phone: "9876123450" },
                              { name: "Dr. Seema Patil", department: "AIML", phone: "9567812340" },
                              { name: "Prof. Rajesh Shastry", department: "Mechanical", phone: "9456712308" },
                              { name: "Dr. Suresh G.", department: "Civil", phone: "9345671209" },
                              { name: "Dr. Neha Deshpande", department: "MBA", phone: "9898765432" },
                              { name: "Prof. Vikram Sen", department: "Mathematics", phone: "9765432109" },
                              { name: "Dr. Asha Hegde", department: "Physics", phone: "9654321098" }
                            ];
                            for (const faculty of sampleFaculties) {
                              await addFaculty(faculty as any);
                            }
                            showToast('Sample faculty members registered successfully!', 'success');
                          } catch (err: any) {
                            showToast(err?.message || 'Failed to seed sample faculty members.', 'error');
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer select-none active:scale-95"
                      >
                        Seed Sample Faculty Data
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                filteredFaculties.map((faculty, idx) => {
                  const isEven = idx % 2 === 1;
                  return (
                    <div 
                      key={faculty.id} 
                      className={`p-3 transition-all duration-200 ease-out relative space-y-1.5 ${
                        isEven 
                          ? 'bg-slate-200/85 text-slate-800' 
                          : 'bg-white text-slate-800'
                      }`}
                    >
                      {/* Top line: Serial # and Department */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-150/60 px-1.5 py-0.5 rounded">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        
                        <span className="bg-blue-50 text-blue-900 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                          {faculty.department}
                        </span>
                      </div>

                      {/* Faculty Name & Phone Details */}
                      <div className="space-y-1">
                        <h5 className="font-extrabold text-slate-800 text-[13px] sm:text-sm leading-tight">
                          {faculty.name}
                        </h5>
                        
                        <div className="text-xs text-slate-600">
                          {faculty.phone ? (
                            <span className="flex items-center gap-1.5 font-medium">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span className="font-mono text-xs">{faculty.phone}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-xs">Phone: Not specified</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-150/50 mt-1">
                        <button
                          onClick={() => handleEdit(faculty)}
                          className="px-2.5 py-1 rounded border border-gray-200 text-blue-700 bg-white hover:bg-blue-50 text-[10px] font-bold uppercase tracking-tight active:scale-[0.98] cursor-pointer"
                          title="Edit Details"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(faculty.id, faculty.name)}
                          className="px-2.5 py-1 rounded border border-gray-200 text-red-600 bg-white hover:bg-red-50 text-[10px] font-bold uppercase tracking-tight active:scale-[0.98] cursor-pointer"
                          title="Delete Faculty"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-between text-xs font-bold text-gray-400 uppercase">
            <span>Showing {filteredFaculties.length} of {faculties.length} Records</span>
          </div>
        </section>
      </div>

      {/* Confirmation Modal Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full shadow-2xl p-6 relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-500 flex-shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1 text-left">
                <h4 className="font-bold text-slate-800 text-lg">Confirm Deletion</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Are you absolutely sure you want to remove <strong className="text-slate-800 font-extrabold">{deleteConfirmName}</strong> from the faculty register? This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
              <button
                disabled={isDeleting}
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmName('');
                }}
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
                ) : 'Delete Faculty'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
