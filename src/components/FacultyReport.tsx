import React, { useState } from 'react';
import { MessageCircle, Download, UserCheck, GraduationCap, CalendarRange } from 'lucide-react';
import { ExamAllocation, Faculty } from '../types';
import { formatDisplayDate } from '../utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface FacultyReportProps {
  allocations: ExamAllocation[];
  searchQuery: string;
  faculties?: Faculty[];
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function FacultyReport({ allocations, searchQuery, faculties, showToast }: FacultyReportProps) {
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');

  // Extract unique sorted faculty list from Firestore allocations
  const uniqueFacultyList = Array.from(
    new Set(allocations.map(a => a.facultyName))
  ).sort((a, b) => a.localeCompare(b));

  // Filter allocations for the selected faculty
  const facultyAllocations = allocations.filter(
    a => a.facultyName === selectedFaculty
  );

  // Apply live search filtering on top of report list if needed
  const filteredAllocations = facultyAllocations.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.facultyName.toLowerCase().includes(q) ||
      item.department.toLowerCase().includes(q)
    );
  });

  // Sort by date ascending (as requested)
  const sortedAllocations = [...filteredAllocations].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const selectedDept = facultyAllocations.length > 0 ? facultyAllocations[0].department : 'N/A';
  const totalDuties = sortedAllocations.length;

  // WhatsApp Message Sender
  const handleSendWhatsApp = () => {
    if (!selectedFaculty) return;

    // Find registered phone number
    const matchedFac = faculties?.find(
      f => f.name.trim().toLowerCase() === selectedFaculty.trim().toLowerCase()
    );
    const rawPhone = matchedFac?.phone || '';
    
    if (!rawPhone) {
      if (showToast) {
        showToast(`No phone number found for ${selectedFaculty}. Please add it in the Faculty Registry first.`, 'error');
      } else {
        alert(`No phone number found for ${selectedFaculty}. Please add it in the Faculty Registry first.`);
      }
      return;
    }

    // Clean phone number: keep only digits
    let cleanPhone = rawPhone.replace(/\D/g, '');
    // If it's a 10-digit number, prepend '91' (Default Indian prefix as college is in Raichur)
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // Construct the WhatsApp message
    let message = `*Sir M. Visvesvaraya College of Engineering, Raichur*\n`;
    message += `*Exam Duty Allocation 2026*\n\n`;
    message += `Dear *${selectedFaculty}*,\n`;
    message += `Here is your exam duty invigilation schedule:\n\n`;
    message += `*Total Duties:* ${totalDuties}\n\n`;
    message += `*Duty Details:*\n`;

    sortedAllocations.forEach((alloc, idx) => {
      message += `${idx + 1}. *${formatDisplayDate(alloc.date)}* (${alloc.session})\n`;
    });

    message += `\n*Instructions to Room Superintendents:*\n`;
    message += `1. Please report to duty 30 minutes before commencement of the exam.\n`;
    message += `2. Do not leave your block without relieving arrangements.\n`;
    message += `3. Verify hall tickets and College ID cards carefully.\n`;
    message += `4. Mobile phones and electronic gadgets are strictly prohibited.\n\n`;
    message += `_Generated via Exam Duty Allocation System_`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    if (showToast) {
      showToast(`Redirecting to WhatsApp to send duty details for ${selectedFaculty}...`, 'success');
    }
  };

  // Professional PDF Export Generator using jsPDF
  const handleDownloadPDF = () => {
    if (!selectedFaculty) return;

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

      // 1. College Header
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

      // 2. Faculty Metadata
      currentY += 12;
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'bold');
      doc.text('Faculty Name:', margin, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedFaculty, margin + 30, currentY);

      doc.setFont('helvetica', 'bold');
      doc.text('Department:', 130, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedDept, 130 + 26, currentY);

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
      }), margin + 35, currentY);

      doc.setFont('helvetica', 'bold');
      doc.text('Total Duties:', 130, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(String(totalDuties), 130 + 26, currentY);

      currentY += 10;

      // 3. Table Headers and Rows
      const tableColumn = ['Serial Number', 'Exam Date', 'Session', 'Department'];
      const tableRows = sortedAllocations.map((alloc, idx) => [
        idx + 1,
        formatDisplayDate(alloc.date),
        alloc.session,
        alloc.department
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

      // Calculate final Y coordinate from table and add instructions
      let finalY = (doc as any).lastAutoTable?.finalY || currentY;
      let currentInstructionY = finalY + 12;
      const pageHeight = doc.internal.pageSize.getHeight();
      const bottomMargin = 22;
      const contentWidth = doc.internal.pageSize.getWidth() - (margin * 2);

      // Helper function to check space and add new page if needed
      const ensureSpace = (neededHeight: number) => {
        if (currentInstructionY + neededHeight > pageHeight - bottomMargin) {
          doc.addPage();
          currentInstructionY = 20; // reset Y to top margin on new page
        }
      };

      // Draw a divider line before instructions if there's space
      ensureSpace(15);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, currentInstructionY - 6, doc.internal.pageSize.getWidth() - margin, currentInstructionY - 6);

      // Draw Header for instructions
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Instructions to the Room Superintendents for Examinations June–July–2026", margin, currentInstructionY);
      currentInstructionY += 6;

      const instructionPoints = [
        "1. They should report-duty 30 minutes before the commencement of Examination.",
        "2. They should not leave their block without making relieving arrangement.",
        "3. Alternate arrangement should be made only with teaching staff, with the permission of Chief Superintendent. They should complete the allotted number of duties (i.e. if alternate arrangement is made, it should be compensated by doing duties on other days).",
        "4. They should physically verify the candidates for possessing any chits. They should not allow candidate to carry mobile phones and any type of electronic gadgets in examination hall.",
        "5. The candidates should not be allowed to write exam without hall ticket and college ID card. They should verify the hall tickets, filled front sheet of answer booklets and college ID cards of students carefully before signing on the answer booklets.",
        "6. They should announce in the examination hall:",
        "“All of you should search your pockets, purses, desks, tables and benches, whether there are any papers, books or notes and if you find any, keep them outside the examination hall before you start answering the paper” and the photocopies of any Xerox, I.S. code books are not allowed.",
        "7. They are also informed to carry black ball point pen to exam halls."
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);

      for (const pt of instructionPoints) {
        // Apply slight indentation for the quoted announcement block in point 6
        const isQuote = pt.startsWith("“All of you");
        const xOffset = isQuote ? margin + 4 : margin;
        const adjustedWidth = isQuote ? contentWidth - 4 : contentWidth;

        const lines = doc.splitTextToSize(pt, adjustedWidth);
        const textHeight = lines.length * 4.2; // tighter line spacing
        ensureSpace(textHeight + 1);
        
        doc.text(lines, xOffset, currentInstructionY);
        currentInstructionY += textHeight + 0.8; // tighter step spacing
      }

      // Add bold PRINCIPAL signature aligned to the right
      ensureSpace(15);
      currentInstructionY += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("PRINCIPAL", doc.internal.pageSize.getWidth() - margin, currentInstructionY, { align: 'right' });

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
      const fileName = `Exam_Duty_Report_${selectedFaculty.replace(/[\s.]+/g, '_')}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Failed to export PDF", err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Selector Card (Hide when printing) */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 print:hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start">
            <span className="w-2 h-6 bg-orange-500 rounded mr-3 mt-1 inline-block"></span>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-lg">
                Faculty Duty Statement Generator
              </h3>
              <p className="text-xs text-slate-500">
                Select a faculty member from Raichur campus registers to instantly generate print-ready duty timetables.
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-80 space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
              Select Faculty Name
            </label>
            <select
              className="w-full p-2.5 border-2 border-slate-200 rounded-lg focus:border-blue-900 outline-none text-slate-800 focus:ring-0 transition-colors text-sm font-medium bg-white"
              value={selectedFaculty}
              onChange={(e) => setSelectedFaculty(e.target.value)}
            >
              <option value="">-- Choose Faculty --</option>
              {uniqueFacultyList.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Report View */}
      {selectedFaculty ? (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Print preview Card container (conforms to standard table style in screen, but becomes paper report styled on Print) */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden print:-mx-4 print:border-none print:shadow-none">
            
            {/* Centered A4 Header (Invisible on standard screen dashboard, shows ONLY on true page print) */}
            <div className="hidden print:block text-center space-y-1.5 py-6 border-b border-double border-slate-300">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none">HKE Society's</p>
              <h2 className="text-lg font-bold text-slate-900 leading-none font-sans">Sir M. Visvesvaraya College of Engineering, Raichur</h2>
              <h3 className="text-sm font-bold text-orange-600 leading-none pb-2 font-serif italic">Exam Duty Allocation 2026</h3>
              
              <div className="grid grid-cols-2 text-left pt-4 px-4 text-[13px] border-t border-slate-200">
                <div className="space-y-1">
                  <p><span className="font-bold text-slate-700">Faculty Name:</span> {selectedFaculty}</p>
                  <p><span className="font-bold text-slate-700">Department:</span> {selectedDept}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p><span className="font-bold text-slate-700">Generated Date:</span> {new Date().toLocaleDateString()}</p>
                  <p><span className="font-bold text-slate-700">Total Duties:</span> {totalDuties}</p>
                </div>
              </div>
            </div>

            {/* Screen Preview Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white print:hidden">
              <div className="flex items-center">
                <span className="w-2 h-6 bg-orange-500 rounded mr-3 inline-block"></span>
                <div>
                  <h4 className="font-bold text-slate-800 text-base">{selectedFaculty}</h4>
                  <div className="flex gap-4 text-xs text-slate-500 font-medium mt-0.5">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                      Dept: <strong className="text-slate-700">{selectedDept}</strong>
                    </span>
                    <span>|</span>
                    <span>Campus: Raichur</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Table Grid */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-slate-500 border-b border-gray-100 uppercase text-[11px] font-bold tracking-wider print:bg-slate-200 print:text-black">
                    <th className="py-4 px-6 w-20 text-center">S.N.</th>
                    <th className="py-4 px-6">Exam Date</th>
                    <th className="py-4 px-6">Session</th>
                    <th className="py-4 px-6">Department</th>
                  </tr>
                </thead>
                
                <tbody className="divide-y divide-gray-100 print:divide-slate-300">
                  {sortedAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400 font-medium">
                        No duties allocated to this faculty.
                      </td>
                    </tr>
                  ) : (
                    sortedAllocations.map((alloc, idx) => {
                      const isEven = idx % 2 === 1;
                      return (
                        <tr 
                          key={alloc.id} 
                          className={`hover:bg-blue-50/50 transition-colors duration-150 print:hover:bg-transparent ${isEven ? 'bg-gray-50/30' : ''}`}
                        >
                          <td className="py-3.5 px-6 font-bold text-xs text-slate-400 text-center print:text-black">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-3.5 px-6 font-bold text-slate-800 print:text-black text-sm">
                            {formatDisplayDate(alloc.date)}
                          </td>
                          <td className="py-3.5 px-6 text-slate-700">
                            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 print:p-0 print:bg-transparent print:text-black">
                              {alloc.session}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-slate-600 font-semibold text-xs print:text-black">
                            {alloc.department}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Duties Summary footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-gray-50 flex justify-between items-center print:bg-transparent print:border-slate-300">
              <span className="text-slate-500 font-bold text-sm uppercase tracking-wider print:text-black print:text-xs">
                Duty Statement Summary
              </span>
              <span className="text-sm font-extrabold text-slate-850 print:text-black">
                Total Duties Assigned : <span className="bg-orange-500 text-white rounded-full px-3 py-1 text-xs print:bg-transparent print:text-black print:p-0 print:font-bold">{totalDuties}</span>
              </span>
            </div>

            {/* Paper Print Footer (Visible only during actual Print page preview) */}
            <div className="hidden print:block text-center py-6 mt-12 border-t border-slate-200">
              <p className="text-xs text-slate-400 italic">
                Generated by Exam Duty Allocation System &bull; Raichur Campus Registry
              </p>
            </div>
          </div>

          {/* Export Control buttons (Hidden when printing!) */}
          <div className="flex flex-wrap justify-end gap-3 print:hidden">
            <button
              onClick={handleSendWhatsApp}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-sm shadow-lg transition-all cursor-pointer"
            >
              <MessageCircle className="h-4.5 w-4.5" />
              Send via WhatsApp
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl font-bold text-sm shadow-lg transition-all cursor-pointer"
            >
              <Download className="h-4.5 w-4.5" />
              Download PDF Report
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-12 px-6 text-center flex flex-col items-center">
          <CalendarRange className="h-10 w-10 text-slate-400 mb-3" />
          <h4 className="font-bold text-slate-700 text-base">Generate Duty Statement</h4>
          <p className="text-sm text-slate-500 max-w-sm mt-1">
            Please choose a faculty member from the dropdown above to review assignation sheets, print physical schedules, or download a high-quality A4 PDF format statement.
          </p>
        </div>
      )}
    </div>
  );
}
