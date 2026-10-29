// src/screens/admin/examinations/PrintExamSheet.tsx
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import {
  Exam,
  ExamSettings,
  ExamColumn,
  ExamQuestion,
  MarksPer,
  ReadingWritingHeader,
  ReadingWritingWeights,
  ReadingCategory,
  SchoolBranding,
  READING_CATEGORIES,
  DEFAULT_COLUMNS,
  DEFAULT_READING_HEADERS,
  DEFAULT_READING_WEIGHTS,
  DEFAULT_MARKS_PER,
  round2,
  getExamFormType,
  getSurahName,
  getJuzName,
  getEnabledSkillHeaders,
  getEnabledCategories,
  getEffectiveWeights,
  getEffectiveMaxTotal,
  calculateExactSkillMaxes,
  calculateCategoryTotal,
  calculateGrandTotal,
  getSurahArabic,
  getJuzArabic,
} from './_shared';

// ============================================================
// TYPES
// ============================================================
export interface PrintExamOptions {
  exam: Exam;
  settings: ExamSettings | null;
  branding?: SchoolBranding | null;
  language?: string; // 'ar' | 'en' | 'so'
}

interface PrintResult {
  uri: string;
}

// ============================================================
// HELPERS
// ============================================================
const esc = (v: any): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Moves a print-generated PDF to a shareable location and returns the
 * new URI. On Android, `expo-sharing` cannot read files in
 * `cacheDirectory` under some SDK versions, so we copy to
 * `documentDirectory`.
 */
const ensureShareablePdf = async (sourceUri: string): Promise<string> => {
  const stamp = Date.now();
  const fileName = `exam-${stamp}.pdf`;

  // Prefer the modern API when available (SDK 51+)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FS: any = FileSystem as any;

  if (FS.Paths && FS.File) {
    // SDK 51+ new API
    const dir = FS.Paths.document;
    const dest = `${dir.uri.replace(/\/$/, '')}/${fileName}`;
    const src = new FS.File(sourceUri);
    const target = new FS.File(dest);
    if (src.exists) {
      // Delete target if exists
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

  // Legacy API (SDK < 51)
  const dir: string =
    FS.documentDirectory || FS.cacheDirectory || '';
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
export const buildExamHtml = (opts: PrintExamOptions): string => {
  const { exam, settings, branding: brandingOverride, language } = opts;
  const formType = getExamFormType(exam);
  const lang = language || 'en';
  const isRTL = lang === 'ar';

  const branding: SchoolBranding =
    brandingOverride ||
    settings?.branding || {
      logo: null,
      nameAr: '',
      nameEn: '',
      nameSo: '',
    };

  const schoolNameAr = branding.nameAr || 'المدرسة العالمية للقرآن الكريم';
  const schoolNameEn = branding.nameEn || 'Global Holy Quran School';
  const schoolNameSo = branding.nameSo || 'Dugsiga Quraanka ee Caalamiga';

  const otherSideName = lang === 'so' ? schoolNameSo : schoolNameEn;
  const leftName = isRTL ? schoolNameAr : otherSideName;
  const rightName = isRTL ? otherSideName : schoolNameAr;

  const logoHtml = branding.logo
    ? `<div class="logo-container"><img src="${branding.logo}" alt="logo"/></div>`
    : `<div class="logo-placeholder">LOGO</div>`;

  const examiners =
    exam.examiners && exam.examiners.length > 0
      ? exam.examiners
      : exam.examiner
      ? [exam.examiner]
      : [];

  const examDate = exam.dateGregorian || exam.date || '';
  const formattedDate = (() => {
    if (!examDate) return '—';
    try {
      const d = new Date(examDate);
      if (isNaN(d.getTime())) return String(examDate);
      return d.toLocaleDateString(
        lang === 'ar' ? 'ar-EG' : lang === 'so' ? 'so-SO' : 'en-US',
        {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }
      );
    } catch {
      return String(examDate);
    }
  })();

  // ----------------------------------------------------------------
  // Reading branch
  // ----------------------------------------------------------------
  const buildReadingSection = (): {
    headersHtml: string;
    bodyHtml: string;
    footerHtml: string;
    summaryHtml: string;
  } => {
    const headers: ReadingWritingHeader[] =
      exam.readingWritingHeaders ||
      settings?.readingWritingHeaders ||
      DEFAULT_READING_HEADERS;

    const weights: ReadingWritingWeights =
      exam.readingWritingWeights ||
      settings?.readingWritingWeights ||
      DEFAULT_READING_WEIGHTS;

    const enabledSkills = exam.enabledSkills || null;
    const enabledCategories = exam.enabledCategories || null;

    const enabledSkillsList = getEnabledSkillHeaders(headers, enabledSkills);
    const enabledCatsList = getEnabledCategories(enabledCategories);
    const effectiveWeights = getEffectiveWeights(weights, enabledCategories);
    const exactMaxes = calculateExactSkillMaxes(
      enabledSkillsList,
      effectiveWeights
    );
    const scores = exam.readingWritingScores || {};

    const headersHtml = `
      <tr>
        <th class="align-start">${esc(
          lang === 'ar' ? 'المهارة' : 'Skill'
        )}</th>
        ${enabledCatsList
          .map((cat) => {
            const label = categoryLabel(cat, lang);
            const color = categoryColor(cat);
            return `<th style="color:${color}">${esc(label)}</th>`;
          })
          .join('')}
        <th>${esc(lang === 'ar' ? 'المجموع' : 'Total')}</th>
      </tr>
    `;

    const bodyHtml = enabledSkillsList
      .map((h, idx) => {
        const rVal = parseFloat(String(scores[`${h.id}_reading`] ?? 0)) || 0;
        const wVal = parseFloat(String(scores[`${h.id}_writing`] ?? 0)) || 0;
        const hjVal = parseFloat(String(scores[`${h.id}_hijaa`] ?? 0)) || 0;
        const ayVal = parseFloat(String(scores[`${h.id}_ayahs`] ?? 0)) || 0;

        const rMax = enabledCatsList.includes('readingScore')
          ? exactMaxes.reading[idx] || 0
          : 0;
        const wMax = enabledCatsList.includes('writingScore')
          ? exactMaxes.writing[idx] || 0
          : 0;
        const hjMax = enabledCatsList.includes('hijaa')
          ? exactMaxes.hijaa[idx] || 0
          : 0;
        const ayMax = enabledCatsList.includes('ayahs')
          ? exactMaxes.ayahs[idx] || 0
          : 0;

        let rowTotal = 0;
        if (enabledCatsList.includes('readingScore')) rowTotal += rVal;
        if (enabledCatsList.includes('writingScore')) rowTotal += wVal;
        if (enabledCatsList.includes('hijaa')) rowTotal += hjVal;
        if (enabledCatsList.includes('ayahs')) rowTotal += ayVal;

        const rowMax = round2(rMax + wMax + hjMax + ayMax);

        return `
          <tr>
            <td class="align-start">${esc(h.label)}</td>
            ${
              enabledCatsList.includes('readingScore')
                ? `<td>${round2(rVal)}<span class="muted"> / ${round2(
                    rMax
                  )}</span></td>`
                : ''
            }
            ${
              enabledCatsList.includes('writingScore')
                ? `<td>${round2(wVal)}<span class="muted"> / ${round2(
                    wMax
                  )}</span></td>`
                : ''
            }
            ${
              enabledCatsList.includes('hijaa')
                ? `<td>${round2(hjVal)}<span class="muted"> / ${round2(
                    hjMax
                  )}</span></td>`
                : ''
            }
            ${
              enabledCatsList.includes('ayahs')
                ? `<td>${round2(ayVal)}<span class="muted"> / ${round2(
                    ayMax
                  )}</span></td>`
                : ''
            }
            <td class="bold">${round2(rowTotal)}<span class="muted"> / ${rowMax}</span></td>
          </tr>
        `;
      })
      .join('');

    const rTotal = calculateCategoryTotal(
      scores,
      enabledSkillsList,
      'readingScore'
    );
    const wTotal = calculateCategoryTotal(
      scores,
      enabledSkillsList,
      'writingScore'
    );
    const hjTotal = calculateCategoryTotal(scores, enabledSkillsList, 'hijaa');
    const ayTotal = calculateCategoryTotal(scores, enabledSkillsList, 'ayahs');
    const grand = calculateGrandTotal(
      scores,
      enabledSkillsList,
      enabledCatsList
    );
    const maxTotal = getEffectiveMaxTotal(weights, enabledCategories);

    const footerHtml = `
      <tr class="footer-row">
        <td class="align-start">${esc(lang === 'ar' ? 'المجموع' : 'Total')}</td>
        ${
          enabledCatsList.includes('readingScore')
            ? `<td>${round2(rTotal)}<span class="muted"> / ${round2(
                effectiveWeights.readingScore
              )}</span></td>`
            : ''
        }
        ${
          enabledCatsList.includes('writingScore')
            ? `<td>${round2(wTotal)}<span class="muted"> / ${round2(
                effectiveWeights.writingScore
              )}</span></td>`
            : ''
        }
        ${
          enabledCatsList.includes('hijaa')
            ? `<td>${round2(hjTotal)}<span class="muted"> / ${round2(
                effectiveWeights.hijaa
              )}</span></td>`
            : ''
        }
        ${
          enabledCatsList.includes('ayahs')
            ? `<td>${round2(ayTotal)}<span class="muted"> / ${round2(
                effectiveWeights.ayahs
              )}</span></td>`
            : ''
        }
        <td class="bold">${round2(grand)}<span class="muted"> / ${round2(
      maxTotal
    )}</span></td>
      </tr>
    `;

    const percent = maxTotal > 0 ? round2((grand / maxTotal) * 100) : 0;
    const passing =
      exam.passingMark ??
      (formType === 'reading'
        ? settings?.passingMarkReadingWriting ?? 60
        : settings?.passingMark ?? 60);
    const grade = gradeLabel(percent, lang);
    const statusLabel =
      percent >= passing ? (lang === 'ar' ? 'ناجح' : 'PASS') : lang === 'ar' ? 'راسب' : 'FAIL';
    const statusColor = percent >= passing ? '#15803d' : '#b91c1c';

    const tiles: { label: string; value: string; max: string; color: string }[] =
      [];
    if (enabledCatsList.includes('readingScore'))
      tiles.push({
        label: categoryLabel('readingScore', lang),
        value: String(round2(rTotal)),
        max: String(round2(effectiveWeights.readingScore)),
        color: '#2563eb',
      });
    if (enabledCatsList.includes('writingScore'))
      tiles.push({
        label: categoryLabel('writingScore', lang),
        value: String(round2(wTotal)),
        max: String(round2(effectiveWeights.writingScore)),
        color: '#16a34a',
      });
    if (enabledCatsList.includes('hijaa'))
      tiles.push({
        label: categoryLabel('hijaa', lang),
        value: String(round2(hjTotal)),
        max: String(round2(effectiveWeights.hijaa)),
        color: '#ea580c',
      });
    if (enabledCatsList.includes('ayahs'))
      tiles.push({
        label: categoryLabel('ayahs', lang),
        value: String(round2(ayTotal)),
        max: String(round2(effectiveWeights.ayahs)),
        color: '#db2777',
      });
    tiles.push({
      label: lang === 'ar' ? 'المجموع الكلي' : 'Grand Total',
      value: String(round2(grand)),
      max: String(round2(maxTotal)),
      color: '#7c3aed',
    });

    const summaryHtml = `
      <table class="score-strip">
        <tr>
          ${tiles
            .map(
              (tt) => `
            <td class="score-cell">
              <h5>${esc(tt.label)}</h5>
              <p style="color:${tt.color}">${esc(tt.value)} / ${esc(tt.max)}</p>
            </td>
          `
            )
            .join('')}
          <td class="score-cell">
            <h5>${esc(lang === 'ar' ? 'التقدير' : 'Grade')}</h5>
            <p style="color:${statusColor}; font-size:12pt;">
              ${esc(grade)} · ${percent}% · ${esc(statusLabel)}
            </p>
          </td>
        </tr>
      </table>
    `;

    return { headersHtml, bodyHtml, footerHtml, summaryHtml };
  };

  // ----------------------------------------------------------------
  // Memorization branch
  // ----------------------------------------------------------------
  const buildMemorizationSection = (): {
    headersHtml: string;
    bodyHtml: string;
    totalRowHtml: string;
    scoreStripHtml: string;
  } => {
    const columnsSource: ExamColumn[] =
      exam.settings?.columns && exam.settings.columns.length > 0
        ? exam.settings.columns
        : settings?.columns && settings.columns.length > 0
        ? settings.columns
        : DEFAULT_COLUMNS;

    const visibleColumns = columnsSource
      .filter(
        (c) =>
          c.isVisible !== false &&
          c.key !== 'question' &&
          c.key !== 'page' &&
          c.key !== 'deduction'
      )
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const marksPer: MarksPer = exam.marksPer || DEFAULT_MARKS_PER;
    const questions: ExamQuestion[] = exam.questions || [];

    const weightFor = (key: string): number => {
      let weightKey = key;
      if (key === 'rujuc') weightKey = 'ruju';
      return marksPer[weightKey] !== undefined ? marksPer[weightKey] : 1.0;
    };

    const headersHtml = `
      <tr>
        <th class="align-start">${esc(
          lang === 'ar' ? 'السؤال' : 'Question'
        )}</th>
        <th>${esc(lang === 'ar' ? 'الصفحة' : 'Page')}</th>
        ${visibleColumns
          .map((c) => {
            const additive = c.isAdditive !== false;
            return `<th>${esc(c.label)}<span class="muted"> ${
              additive ? '(+)' : '(−)'
            }</span></th>`;
          })
          .join('')}
        <th>${esc(lang === 'ar' ? 'الخصم' : 'Deduction')}</th>
      </tr>
    `;

    const bodyHtml = questions
      .map((q, idx) => {
        let totalContrib = 0;
        const cellsHtml = visibleColumns
          .map((col) => {
            let fieldKey: string = col.key;
            if (col.key === 'rujuc') fieldKey = 'ruju';
            const weight = weightFor(col.key);
            let value = 0;
            if (q.customColumns && q.customColumns[col.key] !== undefined) {
              value = q.customColumns[col.key];
            } else if ((q as any)[fieldKey] !== undefined) {
              value = (q as any)[fieldKey];
            }
            const additive = col.isAdditive !== false;
            const contribution = additive
              ? value * weight
              : -(value * weight);
            totalContrib += contribution;
            return `<td>${esc(value)}</td>`;
          })
          .join('');

        const questionLabel = ordinalLabel(idx, lang);
        const color =
          totalContrib > 0
            ? '#15803d'
            : totalContrib < 0
            ? '#b91c1c'
            : '#9ca3af';
        const prefix = totalContrib > 0 ? '+' : '';

        return `
          <tr>
            <td class="align-start bold">${esc(questionLabel)}</td>
            <td>${esc(q.page || '-')}</td>
            ${cellsHtml}
            <td style="color:${color}; font-weight:700;">
              ${prefix}${round2(totalContrib)}
            </td>
          </tr>
        `;
      })
      .join('');

    let grandDeduction = 0;
    const totalCellsHtml = visibleColumns
      .map((col) => {
        let fieldKey: string = col.key;
        if (col.key === 'rujuc') fieldKey = 'ruju';
        const weight = weightFor(col.key);
        const columnSum = questions.reduce((sum, q) => {
          let val = 0;
          if (q.customColumns && q.customColumns[col.key] !== undefined) {
            val = q.customColumns[col.key];
          } else if ((q as any)[fieldKey] !== undefined) {
            val = (q as any)[fieldKey];
          }
          return sum + val * weight;
        }, 0);
        const additive = col.isAdditive !== false;
        const display = additive ? columnSum : -columnSum;
        grandDeduction += display;
        const color =
          display > 0 ? '#15803d' : display < 0 ? '#b91c1c' : '#9ca3af';
        const prefix = display > 0 ? '+' : '';
        return `<td style="color:${color}; font-weight:700;">${prefix}${round2(
          display
        )}</td>`;
      })
      .join('');

    const totalRowHtml = `
      <tr class="footer-row">
        <td colspan="${2}" class="align-end bold">
          ${esc(lang === 'ar' ? 'إجمالي الخصم' : 'Total Deduction')}:
        </td>
        ${totalCellsHtml}
        <td class="bold" style="color:${
          grandDeduction > 0 ? '#b91c1c' : '#15803d'
        };">
          ${round2(grandDeduction)}
        </td>
      </tr>
    `;

    const totalMarks = exam.totalMarks || 100;
    const obtained = round2(exam.obtainedMarks || 0);
    const passing =
      exam.passingMark ??
      (formType === 'reading'
        ? settings?.passingMarkReadingWriting ?? 60
        : settings?.passingMark ?? 60);
    const percentage =
      exam.percentage !== undefined
        ? round2(exam.percentage)
        : totalMarks > 0
        ? round2((obtained / totalMarks) * 100)
        : 0;
    const grade = gradeLabel(percentage, lang);

    const scoreStripHtml = `
      <table class="score-strip">
        <tr>
          <td class="score-cell"><h5>${esc(
            lang === 'ar' ? 'الدرجة الكلية' : 'Total Marks'
          )}</h5><p>${totalMarks}</p></td>
          <td class="score-cell"><h5>${esc(
            lang === 'ar' ? 'الدرجة المحصلة' : 'Obtained'
          )}</h5><p style="color:#15803d;">${obtained}</p></td>
          <td class="score-cell"><h5>${esc(
            lang === 'ar' ? 'درجة النجاح' : 'Passing'
          )}</h5><p>${passing}%</p></td>
          <td class="score-cell"><h5>${esc(
            lang === 'ar' ? 'التقدير' : 'Grade'
          )}</h5><p style="font-size:12pt;color:${
      percentage >= 90
        ? '#15803d'
        : percentage >= 80
        ? '#166534'
        : percentage >= 70
        ? '#b45309'
        : percentage >= 60
        ? '#d97706'
        : '#b91c1c'
    };">${esc(grade)}</p></td>
        </tr>
      </table>
    `;

    return { headersHtml, bodyHtml, totalRowHtml, scoreStripHtml };
  };

  const isMemorization = formType === 'memorization';

  const scopeFrom = exam.examScope
    ? exam.examScope === 'surah'
      ? `${lang === 'ar' ? 'من سورة' : 'From Surah'} ${getSurahName(
          exam.fromSurah
        )}${
          lang === 'ar' && exam.fromSurah
            ? ` (${getSurahArabic(exam.fromSurah)})`
            : ''
        }`
      : `${lang === 'ar' ? 'من جزء' : 'From Juz'} ${getJuzName(
          exam.fromJuz
        )}${
          lang === 'ar' && exam.fromJuz
            ? ` (${getJuzArabic(exam.fromJuz)})`
            : ''
        }`
    : '';
  const scopeTo = exam.examScope
    ? exam.examScope === 'surah'
      ? `${lang === 'ar' ? 'إلى سورة' : 'To Surah'} ${getSurahName(
          exam.toSurah
        )}${
          lang === 'ar' && exam.toSurah
            ? ` (${getSurahArabic(exam.toSurah)})`
            : ''
        }`
      : `${lang === 'ar' ? 'إلى جزء' : 'To Juz'} ${getJuzName(exam.toJuz)}${
          lang === 'ar' && exam.toJuz ? ` (${getJuzArabic(exam.toJuz)})` : ''
        }`
    : '';

  const scopeHtml = scopeFrom
    ? `
      <tr>
        <td class="lbl-bg">${esc(lang === 'ar' ? 'النطاق' : 'Scope')}</td>
        <td colspan="3" class="bold">${esc(scopeFrom)} ➔ ${esc(scopeTo)}</td>
      </tr>
    `
    : '';

  const notesHtml =
    exam.notes?.positive || exam.notes?.negative
      ? `
      <div class="notes-card">
        ${
          exam.notes?.positive
            ? `
          <div class="note-row">
            <div class="note-head">✓ ${esc(
              lang === 'ar' ? 'ملاحظات إيجابية' : 'Positive Notes'
            )}</div>
            <div class="note-body">${esc(exam.notes.positive)}</div>
          </div>
        `
            : ''
        }
        ${
          exam.notes?.negative
            ? `
          <div class="note-row">
            <div class="note-head">⚠ ${esc(
              lang === 'ar' ? 'مجالات التحسين' : 'Areas to Improve'
            )}</div>
            <div class="note-body">${esc(exam.notes.negative)}</div>
          </div>
        `
            : ''
        }
      </div>
    `
      : '';

  const committeeHtml =
    examiners.length > 0
      ? `
      <table class="committee-table">
        <thead>
          <tr>
            <th colspan="2">${esc(
              lang === 'ar' ? 'لجنة الامتحان' : 'Exam Committee'
            )}</th>
          </tr>
        </thead>
        <tbody>
          ${examiners
            .map(
              (ex) => `
            <tr>
              <td style="width:60%; font-weight:600; color:#374151;">${esc(
                ex
              )}</td>
              <td style="width:40%;"><div class="sig-line"></div></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
      : '';

  const memorizationSection = isMemorization
    ? buildMemorizationSection()
    : null;
  const readingSection = !isMemorization ? buildReadingSection() : null;

  const tableHeaders = isMemorization
    ? memorizationSection!.headersHtml
    : readingSection!.headersHtml;
  const tableBody = isMemorization
    ? memorizationSection!.bodyHtml
    : readingSection!.bodyHtml;

  const tableFooter = isMemorization
    ? memorizationSection!.totalRowHtml
    : readingSection!.footerHtml;

  const summaryStrip = isMemorization
    ? memorizationSection!.scoreStripHtml
    : readingSection!.summaryHtml;

  const documentTitle =
    lang === 'ar' ? 'ورقة امتحان الطالب' : 'Student Exam Sheet';

  const html = `
    <!DOCTYPE html>
    <html dir="${isRTL ? 'rtl' : 'ltr'}" lang="${esc(lang)}">
    <head>
      <meta charset="utf-8" />
      <title>${esc(documentTitle)}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: auto; margin: 8mm 10mm; background-color: #ffffff; }
        body {
          font-family: ${isRTL ? "'Amiri', serif" : "'Cairo', sans-serif"};
          background: #ffffff;
          color: #1f2937;
          font-size: 11pt;
          line-height: 1.35;
        }
        .main-wrapper { border: 2px solid #15803d; padding: 4px; border-radius: 6px; }
        .inner-wrapper { border: 1px solid #d97706; padding: 14px; border-radius: 4px; }
        .split-header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .header-side-name { width: 37%; vertical-align: middle; font-size: 15pt; font-weight: 700; color: #000000 !important; }
        .header-center-logo { width: 26%; text-align: center; vertical-align: middle; }
        .logo-container {
          width: 118px;
          height: 118px;
          border-radius: 50%;
          overflow: hidden;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid #15803d;
          background: #ffffff;
        }
        .logo-container img { width: 100%; height: 100%; object-fit: cover; }
        .logo-placeholder {
          width: 118px; height: 118px; border-radius: 50%;
          background: #f0fdf4;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: #15803d;
          border: 3px dashed #15803d; margin: 0 auto;
        }
        .document-title { font-size: 15pt; font-weight: 700; color: #15803d; text-align: center; margin-bottom: 12px; letter-spacing: 0.5px; }

        .table-profile { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .table-profile td { padding: 6px 10px; border: 1px solid #e5e7eb; font-size: 10.5pt; }
        .lbl-bg { background: #f0fdf4; font-weight: 700; color: #15803d; width: 16%; }
        .val-bold { font-weight: 700; color: #111827; }

        .table-data { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .table-data th {
          background: #15803d; color: #ffffff;
          padding: 7px; font-size: 10pt; font-weight: 600;
          border: 1px solid #15803d;
        }
        .table-data td {
          padding: 6px; text-align: center;
          border: 1px solid #cbd5e1; font-size: 10.5pt;
        }
        .table-data tr:nth-child(even) { background-color: #fafafa; }
        .table-data .footer-row { background: #f3e8ff !important; }
        .table-data .footer-row td { font-weight: 800; color: #6d28d9; }
        .align-start { text-align: ${isRTL ? 'right' : 'left'}; padding-${isRTL ? 'right' : 'left'}: 8px; }
        .align-end { text-align: ${isRTL ? 'left' : 'right'}; padding-${isRTL ? 'left' : 'right'}: 12px; }
        .bold { font-weight: 700; }
        .muted { color: #6b7280; font-weight: 500; font-size: 9pt; }

        .score-strip {
          width: 100%; border-collapse: collapse;
          background: #f0fdf4; border: 1.5px solid #15803d;
          border-radius: 4px; margin-bottom: 12px;
        }
        .score-cell {
          text-align: center; padding: 8px 4px;
          border-${isRTL ? 'left' : 'right'}: 1px solid #15803d;
          flex: 1;
        }
        .score-cell:last-child { border-${isRTL ? 'left' : 'right'}: none; }
        .score-cell h5 { font-size: 9pt; color: #d97706; margin-bottom: 1px; font-weight: 700; text-transform: uppercase; }
        .score-cell p { font-size: 14pt; font-weight: 700; color: #111827; }

        .notes-card {
          border: 1px solid #cbd5e1; border-radius: 4px;
          margin-bottom: 12px; background: #fafafa;
        }
        .note-row { padding: 6px 10px; border-bottom: 1px solid #cbd5e1; }
        .note-row:last-child { border-bottom: none; }
        .note-head { font-weight: 700; color: #15803d; font-size: 10pt; margin-bottom: 1px; }
        .note-body { font-size: 9.5pt; color: #4b5563; }

        .committee-table { width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: avoid; }
        .committee-table th {
          background: #f0fdf4; color: #15803d;
          padding: 6px 10px; border: 1px solid #cbd5e1;
          font-size: 10pt; font-weight: 700;
          text-align: ${isRTL ? 'right' : 'left'};
        }
        .committee-table td {
          padding: 8px 10px; border: 1px solid #cbd5e1;
          font-size: 10pt; background: white;
        }
        .sig-line { border-bottom: 1px dashed #9ca3af; margin-top: 8px; min-height: 22px; width: 85%; }
        .footer {
          text-align: center; font-size: 9pt; color: #9ca3af;
          margin-top: 15px; padding-top: 6px;
          border-top: 1px dashed #e5e7eb;
        }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="main-wrapper">
        <div class="inner-wrapper">
          <table class="split-header-table">
            <tr>
              <td class="header-side-name" style="text-align: ${isRTL ? 'right' : 'left'};">
                ${esc(leftName)}
              </td>
              <td class="header-center-logo">
                ${logoHtml}
              </td>
              <td class="header-side-name" style="text-align: ${isRTL ? 'left' : 'right'};">
                ${esc(rightName)}
              </td>
            </tr>
          </table>

          <div class="document-title">${esc(documentTitle)}</div>

          <table class="table-profile">
            <tr>
              <td class="lbl-bg">${esc(lang === 'ar' ? 'الطالب' : 'Student')}</td>
              <td class="val-bold" style="width:34%; font-size:11pt;">${esc(
                exam.studentName || ''
              )}</td>
              <td class="lbl-bg">${esc(lang === 'ar' ? 'التاريخ' : 'Date')}</td>
              <td style="width:34%;">${esc(formattedDate)}</td>
            </tr>
            <tr>
              <td class="lbl-bg">${esc(lang === 'ar' ? 'الحلقة' : 'Halaqah')}</td>
              <td>${esc(exam.halaqah || '')}</td>
              <td class="lbl-bg">${esc(lang === 'ar' ? 'نوع الامتحان' : 'Exam Type')}</td>
              <td>${esc(exam.examType || '')}</td>
            </tr>
            ${scopeHtml}
          </table>

          <table class="table-data">
            <thead>${tableHeaders}</thead>
            <tbody>
              ${tableBody}
              ${tableFooter}
            </tbody>
          </table>

          ${summaryStrip}

          ${notesHtml}

          ${committeeHtml}

          <div class="footer">
            <p>${esc(
              lang === 'ar'
                ? 'هذه الوثيقة تم إنشاؤها بواسطة النظام'
                : 'This document was generated automatically'
            )}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
};

// ============================================================
// PUBLIC API — PRINT
// ============================================================
export const printExamSheet = async (
  opts: PrintExamOptions
): Promise<PrintResult | null> => {
  try {
    const html = buildExamHtml(opts);
    const { uri } = await Print.printToFileAsync({ html });
    await Print.printAsync({ uri });
    return { uri };
  } catch (e) {
    console.warn('printExamSheet failed', e);
    return null;
  }
};

// ============================================================
// PUBLIC API — SHARE AS PDF
// ============================================================
export const shareExamSheetAsPdf = async (
  opts: PrintExamOptions
): Promise<PrintResult | null> => {
  try {
    const html = buildExamHtml(opts);

    // --- Web fallback: just open the print dialog ---
    if (Platform.OS === 'web') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyPrint: any = Print as any;
      if (typeof anyPrint.printAsync === 'function') {
        await anyPrint.printAsync({ html });
      }
      return null;
    }

    // --- Native: generate PDF → move to shareable location → share ---
    const { uri } = await Print.printToFileAsync({ html });

    // Move to a shareable location (fixes "Not allowed to read file under given URL" on Android)
    const shareableUri = await ensureShareablePdf(uri);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(shareableUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share exam sheet',
        UTI: 'com.adobe.pdf',
      });
    } else {
      console.warn('Sharing is not available on this device');
    }
    return { uri: shareableUri };
  } catch (e) {
    console.warn('shareExamSheetAsPdf failed', e);
    return null;
  }
};

// ============================================================
// LABELS / HELPERS
// ============================================================
function categoryLabel(cat: ReadingCategory, lang: string): string {
  const ar = lang === 'ar';
  switch (cat) {
    case 'readingScore':
      return ar ? 'القراءة' : 'Reading';
    case 'writingScore':
      return ar ? 'الكتابة' : 'Writing';
    case 'hijaa':
      return ar ? 'الهجاء' : 'Hijaa';
    case 'ayahs':
      return ar ? 'الآيات' : 'Ayahs';
  }
}

function categoryColor(cat: ReadingCategory): string {
  switch (cat) {
    case 'readingScore':
      return '#2563eb';
    case 'writingScore':
      return '#16a34a';
    case 'hijaa':
      return '#ea580c';
    case 'ayahs':
      return '#db2777';
  }
}

function gradeLabel(pct: number, lang: string): string {
  const ar = lang === 'ar';
  if (pct >= 90) return ar ? 'ممتاز' : 'Excellent';
  if (pct >= 80) return ar ? 'جيد جداً' : 'Very Good';
  if (pct >= 70) return ar ? 'جيد' : 'Good';
  if (pct >= 60) return ar ? 'مقبول' : 'Acceptable';
  return ar ? 'ضعيف' : 'Poor';
}

const ORDINAL_EN = [
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
];

const ORDINAL_AR = [
  'الأول',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
  'التاسع',
  'العاشر',
];

function ordinalLabel(idx: number, lang: string): string {
  const ar = lang === 'ar';
  if (ar) {
    const label = idx < ORDINAL_AR.length ? ORDINAL_AR[idx] : `${idx + 1}`;
    return `السؤال ${label}`;
  }
  const label = idx < ORDINAL_EN.length ? ORDINAL_EN[idx] : `${idx + 1}`;
  return `${label} Question`;
}