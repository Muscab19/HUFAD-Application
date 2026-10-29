// src/screens/admin/reports/ReportPrintSheet.tsx
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import {
  Exam,
  MemorizationRecord,
  AttendanceSession,
  BehaviorRecord,
  FinanceData,
  MonthlyPerf,
  PrintSection,
  ReportData,
  ReportPeriod,
  SchoolInfo,
  STATUS_KEY,
  getDateLocale,
  formatMemorizationRange,
  formatPrintDate,
  getHalaqahName,
  getMonthLabelLong,
  getSafeDate,
  isRTLLanguage,
  round1,
} from './_shared';

// ============================================================
// TYPES
// ============================================================
export interface PrintReportOptions {
  student: any;
  reportData: ReportData | null;
  monthlyPerf: MonthlyPerf[];
  period: ReportPeriod;
  sections: PrintSection[];
  schoolInfo: SchoolInfo;
  language: string;
  /** Live score computed by the parent screen. */
  currentMonthScore: {
    combined: number;
    attendance: number;
    memorizationScore: number;
    behaviorScore: number;
  };
}

interface PrintResult {
  uri: string;
}

// ============================================================
// HTML ESCAPE
// ============================================================
const esc = (v: any): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ============================================================
// SHAREABLE PDF HELPER
// ============================================================
const ensureShareablePdf = async (sourceUri: string): Promise<string> => {
  const stamp = Date.now();
  const fileName = `report-${stamp}.pdf`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FS: any = FileSystem as any;

  if (FS.Paths && FS.File) {
    const dir = FS.Paths.document;
    const dest = `${dir.uri.replace(/\/$/, '')}/${fileName}`;
    const src = new FS.File(sourceUri);
    const target = new FS.File(dest);
    if (src.exists) {
      if (target.exists) {
        try {
          target.delete();
        } catch {}
      }
      src.copy(target);
      return dest;
    }
    return sourceUri;
  }

  const dir: string = FS.documentDirectory || FS.cacheDirectory || '';
  if (!dir) return sourceUri;
  const dest = `${dir.replace(/\/$/, '')}/${fileName}`;
  try {
    await FS.copyAsync({ from: sourceUri, to: dest });
    return dest;
  } catch (e) {
    console.warn('copyAsync failed, using original URI', e);
    return sourceUri;
  }
};

// ============================================================
// HTML BUILDER
// ============================================================
export const buildReportHtml = (opts: PrintReportOptions): string => {
  const {
    student,
    reportData,
    monthlyPerf,
    period,
    sections,
    schoolInfo,
    language,
    currentMonthScore,
  } = opts;

  const isRTL = isRTLLanguage(language);
  const dateLocale = getDateLocale(language);

  const printAll = sections.includes('all');
  const includeOverview = printAll || sections.includes('overview');
  const includeAttendance = printAll || sections.includes('attendance');
  const includeMemorization = printAll || sections.includes('memorization');
  const includeExams = printAll || sections.includes('exams');
  const includeBehavior = printAll || sections.includes('behavior');
  const includeFinance = printAll || sections.includes('finance');

  // ----------------------------------------------------------------
  // Header text
  // ----------------------------------------------------------------
  const schoolName = schoolInfo.nameEn || 'School';
  const schoolNameAr = schoolInfo.nameAr || '';
  const schoolLogo = schoolInfo.logo || '';
  const reportTitle = schoolInfo.reportTitle || 'Student Report';
  const footerNote = schoolInfo.footerNote || '';

  const attendance = reportData?.attendance;
  const memorization = reportData?.memorization;
  const exams = Array.isArray(reportData?.exams) ? reportData!.exams! : [];
  const behavior = Array.isArray(reportData?.behavior)
    ? reportData!.behavior!
    : [];
  const finance = reportData?.finance;

  const safeStudent = student || {
    name: '—',
    regNo: '—',
    halaqah: '—',
    class: '—',
  };

  const safeScore = currentMonthScore || {
    combined: 0,
    attendance: 0,
    memorizationScore: 0,
    behaviorScore: 0,
  };

  const periodLabel =
    period.mode === 'range'
      ? `${period.startDate}  →  ${period.endDate}`
      : getMonthLabelLong(period.month || '', dateLocale);

  const generatedOn = new Date().toLocaleString(dateLocale);

  // ----------------------------------------------------------------
  // Status translation
  // ----------------------------------------------------------------
  const translateStatus = (status?: string): string => {
    if (!status) return '-';
    const key = STATUS_KEY[status];
    if (!key) return status;
    const map: Record<string, { en: string; ar: string }> = {
      present: { en: 'Present', ar: 'حاضر' },
      absent: { en: 'Absent', ar: 'غائب' },
      late: { en: 'Late', ar: 'متأخر' },
      excused: { en: 'Excused', ar: 'بعذر' },
      pass: { en: 'Pass', ar: 'ناجح' },
      fail: { en: 'Fail', ar: 'راسب' },
      paid: { en: 'Paid', ar: 'مدفوع' },
      partial: { en: 'Partial', ar: 'جزئي' },
      unpaid: { en: 'Unpaid', ar: 'غير مدفوع' },
      draft: { en: 'Draft', ar: 'مسودة' },
      published: { en: 'Published', ar: 'منشور' },
    };
    const entry = map[key];
    return entry ? (isRTL ? entry.ar : entry.en) : status;
  };

  // ----------------------------------------------------------------
  // Attendance matrix (only days with records — user preference)
  // ----------------------------------------------------------------
  const attendanceSessions: AttendanceSession[] =
    attendance?.sessions && attendance.sessions.length > 0
      ? [...attendance.sessions].sort(
          (a, b) => (a.slotNumber || 0) - (b.slotNumber || 0)
        )
      : [];

  const attendanceRows = (() => {
    if (!attendanceSessions.length) return [] as {
      date: string;
      weekday: string;
      statuses: Record<number, string>;
      comments: string[];
    }[];

    const map: Record<
      string,
      { statuses: Record<number, string>; comments: string[] }
    > = {};
    attendanceSessions.forEach((s) => {
      (s.daily || []).forEach((entry) => {
        const dateKey = entry.date ? entry.date.split('T')[0] : null;
        if (!dateKey) return;
        if (!map[dateKey]) map[dateKey] = { statuses: {}, comments: [] };
        map[dateKey].statuses[s.slotNumber] = entry.status;
        if (entry.comments) map[dateKey].comments.push(entry.comments);
      });
    });

    // Only days with at least one recorded status
    return Object.keys(map)
      .sort()
      .map((dateKey) => {
        const d = getSafeDate(dateKey);
        return {
          date: dateKey,
          weekday: d.toLocaleDateString(dateLocale, { weekday: 'short' }),
          statuses: map[dateKey].statuses,
          comments: map[dateKey].comments,
        };
      })
      .filter((r) => Object.keys(r.statuses).length > 0);
  })();

  // ----------------------------------------------------------------
  // Section renderers
  // ----------------------------------------------------------------
  const renderOverview = () => {
    // Use last 12 months from monthlyPerf; only show months with > 0
    const perf = Array.isArray(monthlyPerf) ? monthlyPerf : [];
    const withData = perf.filter((m) => (m.combined || 0) > 0);

    return `
      <div class="section">
        <div class="section-header">
          <span class="section-kicker">${esc(
            isRTL ? 'نظرة عامة' : 'OVERVIEW'
          )}</span>
          <span class="section-title">${esc(
            isRTL ? 'ملخص الأداء الشهري' : 'Monthly Performance Summary'
          )}</span>
        </div>

        <div class="summary-grid overview-grid">
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'الدرجة المجمّعة' : 'Overall Grade'
          )}</div><div class="summary-value">${safeScore.combined}%</div></div>
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'نسبة الحضور' : 'Attendance Rate'
          )}</div><div class="summary-value">${safeScore.attendance}%</div></div>
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'مؤشر الحفظ' : 'Memorization Index'
          )}</div><div class="summary-value">${safeScore.memorizationScore}%</div></div>
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'مؤشر السلوك' : 'Behavior Index'
          )}</div><div class="summary-value">${safeScore.behaviorScore}%</div></div>
        </div>

        <table class="data-table">
          <thead><tr>
            <th>${esc(isRTL ? 'الشهر' : 'Month')}</th>
            <th class="center">${esc(isRTL ? 'الدرجة' : 'Combined')}</th>
            <th class="center">${esc(isRTL ? 'الحضور' : 'Attendance')}</th>
            <th class="center">${esc(isRTL ? 'الحفظ' : 'Memorization')}</th>
            <th class="center">${esc(isRTL ? 'السلوك' : 'Behavior')}</th>
          </tr></thead>
          <tbody>
            ${
              withData.length > 0
                ? withData
                    .map(
                      (m) => `
                <tr>
                  <td><strong>${esc(
                    getMonthLabelLong(m.month, dateLocale)
                  )}</strong></td>
                  <td class="center score-cell">${m.combined || 0}%</td>
                  <td class="center">${m.attendance || 0}%</td>
                  <td class="center">${m.memorization || 0}/10</td>
                  <td class="center">${
                    (m.behavior || 0) > 0 ? '+' : ''
                  }${m.behavior || 0}</td>
                </tr>`
                    )
                    .join('')
                : `<tr><td colspan="5" class="center muted">${esc(
                    isRTL ? 'لا توجد بيانات تاريخية' : 'No historical data'
                  )}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  };

  const renderAttendance = () => {
    if (!attendanceSessions.length) {
      return `
        <div class="section">
          <div class="section-header">
            <span class="section-kicker">${esc(
              isRTL ? 'الحضور' : 'ATTENDANCE'
            )}</span>
            <span class="section-title">${esc(
              isRTL ? 'ملخص الحضور' : 'Attendance Summary'
            )}</span>
          </div>
          <div class="summary-grid attendance-grid">
            <div class="summary-card"><div class="summary-label">${esc(
              isRTL ? 'الحاضر' : 'Present'
            )}</div><div class="summary-value">${
        attendance?.summary?.present || 0
      }</div></div>
            <div class="summary-card"><div class="summary-label">${esc(
              isRTL ? 'المتأخر' : 'Late'
            )}</div><div class="summary-value">${
        attendance?.summary?.late || 0
      }</div></div>
            <div class="summary-card"><div class="summary-label">${esc(
              isRTL ? 'الغائب' : 'Absent'
            )}</div><div class="summary-value">${
        attendance?.summary?.absent || 0
      }</div></div>
            <div class="summary-card"><div class="summary-label">${esc(
              isRTL ? 'بعذر' : 'Excused'
            )}</div><div class="summary-value">${
        attendance?.summary?.excused || 0
      }</div></div>
          </div>
          <p class="muted">${esc(
            isRTL ? 'لا توجد جلسات مسجلة' : 'No recorded sessions'
          )}</p>
        </div>
      `;
    }

    const sessionHeaders = attendanceSessions
      .map(
        (s) => `
      <th class="center">
        ${esc(
          s.name ||
            (isRTL ? `الجلسة ${s.slotNumber}` : `Session ${s.slotNumber}`)
        )}
        <div class="table-subtext">${esc(s.startTime || '')}${
          s.endTime ? '-' + esc(s.endTime) : ''
        }</div>
      </th>`
      )
      .join('');

    const rows = attendanceRows
      .map(
        (day) => `
      <tr>
        <td>${esc(formatPrintDate(day.date, dateLocale))}</td>
        <td class="center">${esc(day.weekday)}</td>
        ${attendanceSessions
          .map((s) => {
            const status = day.statuses[s.slotNumber];
            if (!status || status === 'Not Recorded') {
              return `<td class="center muted">${esc(
                isRTL ? '—' : '-'
              )}</td>`;
            }
            return `<td class="center"><strong>${esc(
              translateStatus(status)
            )}</strong></td>`;
          })
          .join('')}
        <td>${esc(day.comments.join('; ') || '-')}</td>
      </tr>`
      )
      .join('');

    return `
      <div class="section">
        <div class="section-header">
          <span class="section-kicker">${esc(
            isRTL ? 'الحضور' : 'ATTENDANCE'
          )}</span>
          <span class="section-title">${esc(
            isRTL
              ? `سجل الحضور — ${safeStudent.name}`
              : `Attendance Record — ${safeStudent.name}`
          )}</span>
        </div>
        <div class="section-context">
          <strong>${esc(safeStudent.regNo || '')}</strong>
          <span class="context-divider">•</span>
          <span>${esc(periodLabel)}</span>
        </div>

        <div class="summary-grid attendance-grid">
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'الإجمالي' : 'Total Sessions'
          )}</div><div class="summary-value">${
      attendance?.summary?.total || 0
    }</div></div>
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'الحاضر' : 'Present'
          )}</div><div class="summary-value">${
      attendance?.summary?.present || 0
    }</div></div>
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'الغائب' : 'Absent'
          )}</div><div class="summary-value">${
      attendance?.summary?.absent || 0
    }</div></div>
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'المتأخر' : 'Late'
          )}</div><div class="summary-value">${
      attendance?.summary?.late || 0
    }</div></div>
          <div class="summary-card"><div class="summary-label">${esc(
            isRTL ? 'بعذر' : 'Excused'
          )}</div><div class="summary-value">${
      attendance?.summary?.excused || 0
    }</div></div>
        </div>

        <table class="data-table attendance-table">
          <thead><tr>
            <th>${esc(isRTL ? 'التاريخ' : 'Date')}</th>
            <th class="center">${esc(isRTL ? 'اليوم' : 'Day')}</th>
            ${sessionHeaders}
            <th>${esc(isRTL ? 'ملاحظات' : 'Comments')}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  const renderMemorization = () => {
    const records: MemorizationRecord[] = memorization?.allRecords || [];
    return `
      <div class="section">
        <div class="section-header">
          <span class="section-kicker">${esc(
            isRTL ? 'الحفظ' : 'MEMORIZATION'
          )}</span>
          <span class="section-title">${esc(
            isRTL ? 'سجل الحفظ والمراجعة' : 'Memorization & Review'
          )}</span>
        </div>
        ${
          records.length > 0
            ? `
          <table class="data-table">
            <thead><tr>
              <th>${esc(isRTL ? 'التاريخ' : 'Date')}</th>
              <th>${esc(isRTL ? 'النوع' : 'Type')}</th>
              <th>${esc(isRTL ? 'النطاق' : 'Range')}</th>
              <th class="center">${esc(isRTL ? 'المحاولة' : 'Attempt')}</th>
              <th class="center">${esc(isRTL ? 'الدرجة' : 'Score')}</th>
              <th>${esc(isRTL ? 'ملاحظات' : 'Comment')}</th>
            </tr></thead>
            <tbody>
              ${records
                .map((r) => {
                  const isSubac = r.type === 'subac';
                  const isTashiih = r.type === 'tashiih';
                  const showAttempt = !isSubac && !isTashiih;
                  const scoreText = isSubac
                    ? `${r.score}/${r.totalMarks || 100}`
                    : `${r.score}/10`;
                  return `
                    <tr>
                      <td>${esc(formatPrintDate(r.date, dateLocale))}</td>
                      <td>${esc(r.type || '-')}</td>
                      <td>${esc(formatMemorizationRange(r))}</td>
                      <td class="center">${
                        showAttempt ? r.attempt || 1 : '—'
                      }</td>
                      <td class="center score-cell"><strong>${esc(
                        scoreText
                      )}</strong></td>
                      <td>${esc(r.comment || '—')}</td>
                    </tr>`;
                })
                .join('')}
            </tbody>
          </table>`
            : `<p class="muted">${esc(
                isRTL ? 'لا توجد سجلات حفظ' : 'No memorization records'
              )}</p>`
        }
      </div>
    `;
  };

  const renderExams = () => `
    <div class="section">
      <div class="section-header">
        <span class="section-kicker">${esc(isRTL ? 'الامتحانات' : 'EXAMS')}</span>
        <span class="section-title">${esc(
          isRTL ? 'نتائج الامتحانات' : 'Exam Results'
        )}</span>
      </div>
      ${
        exams.length > 0
          ? `
        <table class="data-table">
          <thead><tr>
            <th>${esc(isRTL ? 'الطالب' : 'Student')}</th>
            <th>${esc(isRTL ? 'النوع' : 'Exam Type')}</th>
            <th>${esc(isRTL ? 'النموذج' : 'Form')}</th>
            <th class="center">${esc(isRTL ? 'الدرجة' : 'Marks')}</th>
            <th class="center">${esc(isRTL ? 'الحالة' : 'Status')}</th>
            <th class="center">${esc(isRTL ? 'النشر' : 'Publish')}</th>
            <th>${esc(isRTL ? 'التاريخ' : 'Date')}</th>
          </tr></thead>
          <tbody>
            ${exams
              .map((e: Exam) => {
                const isReading =
                  e.formType === 'reading' || e.examFormType === 'reading';
                const score = round1(e.score || 0);
                const total = e.total || e.totalMarks || 100;
                const pct = round1(e.percentage || 0);
                const status = e.status || (pct >= 60 ? 'Pass' : 'Fail');
                return `
                  <tr>
                    <td><strong>${esc(
                      e.studentName || safeStudent.name
                    )}</strong><br /><span class="table-subtext">${esc(
                  e.halaqah || getHalaqahName(safeStudent.halaqah)
                )}</span></td>
                    <td>${esc(
                      e.type || (isRTL ? 'شهري' : 'Monthly')
                    )}</td>
                    <td>${esc(
                      isReading
                        ? isRTL
                          ? '📖 قراءة'
                          : '📖 Reading'
                        : isRTL
                        ? '📝 حفظ'
                        : '📝 Memorization'
                    )}</td>
                    <td class="center"><strong>${score}</strong>/${total}<br /><span class="table-subtext">${pct}%</span></td>
                    <td class="center"><strong>${esc(
                      translateStatus(status)
                    )}</strong></td>
                    <td class="center">${esc(
                      e.isPublished
                        ? isRTL
                          ? 'منشور'
                          : 'Published'
                        : isRTL
                        ? 'مسودة'
                        : 'Draft'
                    )}</td>
                    <td>${esc(formatPrintDate(e.date, dateLocale))}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>`
          : `<p class="muted">${esc(
              isRTL ? 'لا توجد امتحانات' : 'No exams recorded'
            )}</p>`
      }
    </div>
  `;

  const renderBehavior = () => `
    <div class="section">
      <div class="section-header">
        <span class="section-kicker">${esc(isRTL ? 'السلوك' : 'BEHAVIOR')}</span>
        <span class="section-title">${esc(
          isRTL ? 'سجل السلوك' : 'Behavior Record'
        )}</span>
      </div>
      ${
        behavior.length > 0
          ? `
        <table class="data-table">
          <thead><tr>
            <th>${esc(isRTL ? 'التاريخ' : 'Date')}</th>
            <th class="center">${esc(isRTL ? 'التصنيف' : 'Type')}</th>
            <th>${esc(isRTL ? 'الوصف' : 'Description')}</th>
            <th>${esc(isRTL ? 'الفئة' : 'Category')}</th>
            <th class="center">${esc(isRTL ? 'النتيجة' : 'Impact')}</th>
          </tr></thead>
          <tbody>
            ${behavior
              .map(
                (b: BehaviorRecord) => `
              <tr>
                <td>${esc(formatPrintDate(b.date, dateLocale))}</td>
                <td class="center">${esc(
                  b.type === 'good'
                    ? isRTL
                      ? 'إيجابي'
                      : 'Commendation'
                    : isRTL
                    ? 'سلبي'
                    : 'Disciplinary'
                )}</td>
                <td>${esc(b.description)}</td>
                <td>${esc(b.category || '-')}</td>
                <td class="center score-cell">${
                  (b.points || 0) > 0 ? '+' : ''
                }${b.points || 0}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>`
          : `<p class="muted">${esc(
              isRTL ? 'لا توجد سجلات سلوك' : 'No behavior records'
            )}</p>`
      }
    </div>
  `;

  const renderFinance = () => `
    <div class="section">
      <div class="section-header">
        <span class="section-kicker">${esc(isRTL ? 'المالية' : 'FINANCE')}</span>
        <span class="section-title">${esc(
          isRTL ? 'الملخص المالي' : 'Financial Summary'
        )}</span>
      </div>
      <div class="summary-grid finance-grid">
        <div class="summary-card"><div class="summary-label">${esc(
          isRTL ? 'المستحق' : 'Billed'
        )}</div><div class="summary-value">$${(
    finance?.summary?.totalDue || 0
  ).toFixed(2)}</div></div>
        <div class="summary-card"><div class="summary-label">${esc(
          isRTL ? 'المدفوع' : 'Paid'
        )}</div><div class="summary-value">$${(
    finance?.summary?.totalPaid || 0
  ).toFixed(2)}</div></div>
        <div class="summary-card"><div class="summary-label">${esc(
          isRTL ? 'الرصيد' : 'Balance'
        )}</div><div class="summary-value">$${(
    finance?.summary?.balance || 0
  ).toFixed(2)}</div></div>
      </div>
    </div>
  `;

  // ----------------------------------------------------------------
  // Masthead
  // ----------------------------------------------------------------
  const headerHtml = `
    <div class="masthead">
      <div class="masthead-main">
        <div class="brand-block ${isRTL ? 'brand-right' : 'brand-left'}">
          ${
            schoolLogo
              ? `<img src="${schoolLogo}" alt="Logo" class="header-logo" />`
              : `<div class="logo-placeholder">${esc(
                  isRTL ? 'شعار' : 'LOGO'
                )}</div>`
          }
        </div>
        <div class="institution-block">
          ${
            isRTL && schoolNameAr
              ? `<div class="school-name-ar" dir="rtl">${esc(
                  schoolNameAr
                )}</div>`
              : `<div class="school-name-en">${esc(schoolName)}</div>`
          }
          ${
            !isRTL && schoolNameAr
              ? `<div class="school-name-ar secondary-name" dir="rtl">${esc(
                  schoolNameAr
                )}</div>`
              : ''
          }
          ${
            isRTL
              ? `<div class="school-name-en secondary-name">${esc(
                  schoolName
                )}</div>`
              : ''
          }
          ${
            schoolInfo.phone || schoolInfo.email
              ? `<div class="contact-line">${esc(
                  [schoolInfo.phone, schoolInfo.email]
                    .filter(Boolean)
                    .join('  •  ')
                )}</div>`
              : ''
          }
          ${
            schoolInfo.address
              ? `<div class="contact-line">${esc(schoolInfo.address)}</div>`
              : ''
          }
        </div>
        <div class="document-badge">
          <div class="badge-label">${esc(
            isRTL ? 'وثيقة رسمية' : 'OFFICIAL DOCUMENT'
          )}</div>
          <div class="badge-title">${esc(reportTitle)}</div>
          <div class="badge-period">${esc(periodLabel)}</div>
        </div>
      </div>
      <div class="masthead-rule"></div>
    </div>
  `;

  // ----------------------------------------------------------------
  // Full HTML
  // ----------------------------------------------------------------
  return `
    <!DOCTYPE html>
    <html lang="${esc(language)}" dir="${isRTL ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="UTF-8" />
      <title>${esc(reportTitle)} — ${esc(safeStudent.name)}</title>
      <style>
        :root {
          --ink: #1f2933;
          --muted: #667085;
          --line: #d9dee5;
          --soft: #f6f7f8;
          --paper: #ffffff;
          --accent: #174b3a;
          --accent-dark: #10382c;
          --accent-soft: #edf4f1;
          --gold: #a37b2c;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        @page { size: A4; margin: 13mm 13mm 16mm 13mm; }
        body {
          font-family: ${
            isRTL
              ? "'Amiri','Noto Naskh Arabic','Traditional Arabic','Segoe UI',sans-serif"
              : "'Inter','Segoe UI',Arial,sans-serif"
          };
          color: var(--ink);
          background: var(--paper);
          font-size: 9.5px;
          line-height: 1.45;
          direction: ${isRTL ? 'rtl' : 'ltr'};
          text-align: ${isRTL ? 'right' : 'left'};
          -webkit-font-smoothing: antialiased;
        }
        .header-frame { margin: 0 0 13px 0; page-break-inside: avoid; }
        .masthead-main {
          display: grid;
          grid-template-columns: 18% 54% 28%;
          align-items: center;
          min-height: 78px;
        }
        .brand-block { display: flex; align-items: center; }
        .brand-left { justify-content: flex-start; }
        .brand-right { justify-content: flex-end; }
        .header-logo { width: 94px; height: 94px; object-fit: contain; }
        .logo-placeholder {
          width: 58px; height: 58px;
          border: 1px solid var(--line);
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); font-size: 7px; text-align: center;
        }
        .institution-block { padding: 0 12px; ${isRTL ? 'text-align:right;' : 'text-align:left;'} }
        .school-name-en {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 17px; line-height: 1.15; font-weight: 700;
          color: var(--accent-dark); letter-spacing: .1px;
        }
        .school-name-ar {
          font-family: 'Amiri','Noto Naskh Arabic','Traditional Arabic',serif;
          font-size: 17px; line-height: 1.25; font-weight: 700;
          color: var(--accent-dark);
        }
        .secondary-name { font-size: 10px; margin-top: 3px; color: #53606b; font-weight: 600; }
        .contact-line {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 7.8px; line-height: 1.45; color: var(--muted); margin-top: 3px;
        }
        .document-badge {
          border-${isRTL ? 'right' : 'left'}: 3px solid var(--accent);
          padding: 7px 9px;
          background: var(--soft);
          ${isRTL ? 'text-align:right;' : 'text-align:left;'}
        }
        .badge-label {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 6.5px; font-weight: 800; letter-spacing: 1.1px;
          color: var(--gold); text-transform: uppercase;
        }
        .badge-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 10px; font-weight: 700; color: var(--accent-dark); margin-top: 2px;
        }
        .badge-period {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 7.5px; color: var(--muted); margin-top: 2px;
        }
        .masthead-rule { height: 3px; background: var(--accent); margin-top: 8px; position: relative; }
        .masthead-rule::after {
          content: ''; display: block; width: 20%; height: 2px;
          background: var(--gold); position: absolute;
          ${isRTL ? 'right:0;' : 'left:0;'} top: 3px;
        }
        .meta-line {
          display: flex; justify-content: space-between; align-items: center;
          gap: 10px; margin: 8px 0 13px; padding: 5px 0;
          border-bottom: 1px solid var(--line);
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 7.4px; color: var(--muted); flex-wrap: wrap;
        }
        .info-table {
          width: 100%; border-collapse: collapse; margin: 0 0 16px;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 8.5px; border: 1px solid var(--line);
        }
        .info-table td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        .info-table tr:last-child td { border-bottom: 0; }
        .info-label {
          width: 13%; font-weight: 800; color: var(--accent-dark);
          background: var(--accent-soft);
          text-transform: uppercase; letter-spacing: .35px; font-size: 7px;
        }
        .section { margin-bottom: 18px; page-break-inside: avoid; }
        .section-header {
          display: flex; align-items: baseline; gap: 7px;
          border-bottom: 1.5px solid var(--accent);
          padding-bottom: 4px; margin-bottom: 8px; page-break-after: avoid;
        }
        .section-kicker {
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 6.2px; font-weight: 800; letter-spacing: 1px; color: var(--gold);
        }
        .section-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 12px; font-weight: 700; color: var(--accent-dark);
        }
        .section-context {
          display: flex; gap: 7px; align-items: center;
          margin: -2px 0 8px;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 7.5px; color: var(--muted);
        }
        .context-divider { color: var(--gold); }
        .summary-grid { display: grid; gap: 6px; margin-bottom: 9px; font-family: 'Segoe UI', Arial, sans-serif; }
        .overview-grid { grid-template-columns: repeat(4, 1fr); }
        .attendance-grid { grid-template-columns: repeat(5, 1fr); }
        .finance-grid { grid-template-columns: repeat(3, 1fr); max-width: 75%; }
        .summary-card {
          min-height: 49px; border: 1px solid var(--line); border-top: 3px solid var(--accent);
          padding: 6px 5px; text-align: center; background: #fff; page-break-inside: avoid;
        }
        .summary-label {
          font-size: 6.5px; line-height: 1.2; font-weight: 800;
          color: var(--muted); text-transform: uppercase; letter-spacing: .35px;
        }
        .summary-value {
          font-size: 15px; line-height: 1.1; font-weight: 750;
          color: var(--accent-dark); margin-top: 5px;
        }
        .data-table {
          width: 100%; border-collapse: collapse;
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 7.7px; margin: 0 0 8px; table-layout: auto;
        }
        .data-table thead { display: table-header-group; }
        .data-table th {
          background: var(--accent-dark); color: #fff;
          padding: 5px; text-align: ${isRTL ? 'right' : 'left'};
          font-size: 6.8px; line-height: 1.25; font-weight: 800;
          letter-spacing: .35px; border: 1px solid var(--accent-dark);
          text-transform: uppercase;
        }
        .data-table td {
          padding: 4.5px 5px; border: 1px solid var(--line);
          text-align: ${isRTL ? 'right' : 'left'};
          vertical-align: top; background: #fff;
        }
        .data-table tbody tr:nth-child(even) td { background: #fafbfb; }
        .data-table tbody tr { page-break-inside: avoid; }
        .data-table .center { text-align: center; }
        .score-cell { font-weight: 700; color: var(--accent-dark); }
        .table-subtext { font-size: 6.7px; color: var(--muted); font-weight: 400; }
        .muted { color: var(--muted); font-style: italic; }
        .footer-frame {
          margin-top: 24px; padding-top: 7px;
          border-top: 1px solid var(--accent);
          font-family: 'Segoe UI', Arial, sans-serif;
          font-size: 7px; color: var(--muted); page-break-inside: avoid;
        }
        .footer-note { text-align: center; margin-bottom: 5px; color: #59636d; font-style: italic; }
        .footer-meta { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        @media print {
          html, body { background: #fff !important; }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .section { page-break-inside: avoid; }
          .data-table tr { page-break-inside: avoid; }
          .data-table thead { display: table-header-group; }
        }
      </style>
    </head>
    <body>
      <div class="header-frame">
        ${headerHtml}
        <div class="meta-line">
          <span>${esc(isRTL ? 'وثيقة' : 'DOCUMENT')}: ${esc(
    reportTitle.toUpperCase()
  )}</span>
          <span>${esc(isRTL ? 'الفترة' : 'PERIOD')}: ${esc(periodLabel)}</span>
          <span>${esc(isRTL ? 'تاريخ الإصدار' : 'GENERATED')}: ${esc(
    generatedOn
  )}</span>
        </div>
      </div>

      <table class="info-table">
        <tr>
          <td class="info-label">${esc(
            isRTL ? 'اسم الطالب' : 'STUDENT'
          )}:</td>
          <td><strong>${esc(safeStudent.name)}</strong></td>
          <td class="info-label">${esc(
            isRTL ? 'رقم التسجيل' : 'REGISTRATION ID'
          )}:</td>
          <td>${esc(safeStudent.regNo || '-')}</td>
        </tr>
        <tr>
          <td class="info-label">${esc(isRTL ? 'الحلقة' : 'HALAQAH')}:</td>
          <td>${esc(
            typeof safeStudent.halaqah === 'object'
              ? safeStudent.halaqah?.name || '-'
              : safeStudent.halaqah || '-'
          )}</td>
          <td class="info-label">${esc(isRTL ? 'الصف' : 'CLASS')}:</td>
          <td>${esc(safeStudent.class || '-')}</td>
        </tr>
      </table>

      ${includeOverview ? renderOverview() : ''}
      ${includeAttendance ? renderAttendance() : ''}
      ${includeMemorization ? renderMemorization() : ''}
      ${includeExams ? renderExams() : ''}
      ${includeBehavior ? renderBehavior() : ''}
      ${includeFinance ? renderFinance() : ''}

      <div class="footer-frame">
        ${footerNote ? `<div class="footer-note">${esc(footerNote)}</div>` : ''}
        <div class="footer-meta">
          <span>${esc(
            isRTL
              ? 'وثيقة مصدقة'
              : 'CERTIFIED DOCUMENT'
          )} • ${esc(schoolName)}</span>
          <span>${esc(
            isRTL
              ? 'سجلات سرية'
              : 'CONFIDENTIAL RECORDS'
          )}</span>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ============================================================
// PUBLIC — PRINT
// ============================================================
export const printReportSheet = async (
  opts: PrintReportOptions
): Promise<PrintResult | null> => {
  try {
    const html = buildReportHtml(opts);
    const { uri } = await Print.printToFileAsync({ html });
    await Print.printAsync({ uri });
    return { uri };
  } catch (e) {
    console.warn('printReportSheet failed', e);
    return null;
  }
};

// ============================================================
// PUBLIC — SHARE AS PDF
// ============================================================
export const shareReportAsPdf = async (
  opts: PrintReportOptions
): Promise<PrintResult | null> => {
  try {
    const html = buildReportHtml(opts);

    if (Platform.OS === 'web') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyPrint: any = Print as any;
      if (typeof anyPrint.printAsync === 'function') {
        await anyPrint.printAsync({ html });
      }
      return null;
    }

    const { uri } = await Print.printToFileAsync({ html });
    const shareableUri = await ensureShareablePdf(uri);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(shareableUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share report',
        UTI: 'com.adobe.pdf',
      });
    } else {
      console.warn('Sharing is not available on this device');
    }

    return { uri: shareableUri };
  } catch (e) {
    console.warn('shareReportAsPdf failed', e);
    return null;
  }
};