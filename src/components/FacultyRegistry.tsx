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
  Phone
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

  const handleDelete = async (id: string, facultyName: string) => {
    if (window.confirm(`Are you sure you want to remove ${facultyName} from the faculty register?`)) {
      setIsLoading(true);
      try {
        await removeFaculty(id);
        showToast('Faculty removed successfully', 'success');
        if (editingFaculty?.id === id) {
          handleCancelEdit();
        }
      } catch (err: any) {
        showToast(err?.message || 'Failed to remove faculty member.', 'error');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Filtered Registry List
  const filteredFaculties = faculties.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

            {/* Live Search inside directory */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search faculty or dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-900 transition-all"
              />
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          {/* Directory Content */}
          <div className="overflow-auto max-h-[450px] flex-1">
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
                      {searchQuery 
                        ? 'No faculty matched your query description.' 
                        : 'No faculty members registered in directory. Use the register widget to add members.'}
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
          
          <div className="p-4 bg-gray-50 border-t border-gray-150 flex items-center justify-between text-xs font-bold text-gray-400 uppercase">
            <span>Showing {filteredFaculties.length} of {faculties.length} Records</span>
          </div>
        </section>
      </div>
    </div>
  );
}
