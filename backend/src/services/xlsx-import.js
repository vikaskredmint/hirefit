import ExcelJS from "exceljs";

const text = (value) => {
  if (value == null) return null;
  if (typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.result) return String(value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("").trim();
    if (value.hyperlink) return String(value.text || value.hyperlink).trim();
  }
  const str = String(value).trim();
  return str.length ? str : null;
};

const firstEmail = (value) => {
  const raw = text(value);
  if (!raw) return { primary: null, raw: null };
  const [primary] = raw.split(/[,;/\s]+/).filter(Boolean);
  return { primary: primary?.toLowerCase() || null, raw };
};

export function parseExperienceYears(value) {
  const raw = text(value);
  if (!raw) return null;
  const year = raw.match(/(\d+(?:\.\d+)?)\s*year/i)?.[1];
  const month = raw.match(/(\d+(?:\.\d+)?)\s*month/i)?.[1];
  if (year || month) return Number(((Number(year || 0) * 12 + Number(month || 0)) / 12).toFixed(2));
  const numeric = raw.match(/\d+(?:\.\d+)?/)?.[0];
  return numeric ? Number(numeric) : null;
}

export function parseSalaryInr(value) {
  const raw = text(value)?.toLowerCase();
  if (!raw) return null;
  const amount = Number(raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] || 0);
  if (!amount) return null;
  if (/(crore|cr)/i.test(raw)) return Math.round(amount * 10000000);
  if (/(lakh|lakhs|lac|lacs|lk)/i.test(raw)) return Math.round(amount * 100000);
  if (/(thousand|k\b)/i.test(raw)) return Math.round(amount * 1000);
  return Math.round(amount);
}

const normalized = (value) => (text(value) || "").toLowerCase().replace(/\s+/g, " ").trim();

const headerMapFor = (worksheet) => {
  const headerRow = worksheet.getRow(1);
  const headers = new Map();
  headerRow.eachCell((cell, col) => {
    const label = text(cell.value);
    if (label) headers.set(label, col);
  });
  return headers;
};

const cellText = (row, headers, name) => {
  const col = headers.get(name);
  return col ? text(row.getCell(col).value) : null;
};

const profileUrl = (row, headers) => {
  const col = headers.get("Candidate profile");
  if (!col) return null;
  const cell = row.getCell(col);
  return cell.hyperlink || cell.value?.hyperlink || text(cell.value);
};

const educationSummary = (row, headers) =>
  [
    "Under Graduation degree",
    "UG University",
    "PG specialization",
    "PG university",
  ]
    .map((name) => cellText(row, headers, name))
    .filter(Boolean)
    .join(" | ") || null;

const screeningAnswers = (row, headers, extra = {}) => {
  const answers = { ...extra };
  for (const [label, col] of headers.entries()) {
    const match = label.match(/^Ans\((.*)\)$/i);
    if (!match) continue;
    const answer = text(row.getCell(col).value);
    if (answer) answers[match[1].trim()] = answer;
  }
  return Object.keys(answers).length ? answers : null;
};

export async function parseNaukriWorkbook(buffer, jobTitle) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Workbook has no sheets");

  const headers = headerMapFor(worksheet);
  const rows = [];
  const skipped = { empty: 0, wrongJob: 0 };
  const expectedTitle = normalized(jobTitle);

  for (let rowNo = 2; rowNo <= worksheet.rowCount; rowNo += 1) {
    const row = worksheet.getRow(rowNo);
    const name = cellText(row, headers, "Name");
    if (!name) {
      skipped.empty += 1;
      continue;
    }

    const rowJobTitle = cellText(row, headers, "Job Title");
    if (rowJobTitle && expectedTitle && normalized(rowJobTitle) !== expectedTitle) {
      skipped.wrongJob += 1;
      continue;
    }

    const email = firstEmail(cellText(row, headers, "Email ID"));
    rows.push({
      name,
      email: email.primary,
      phone: cellText(row, headers, "Phone Number"),
      current_location: cellText(row, headers, "Current Location"),
      preferred_locations: cellText(row, headers, "Preferred Locations"),
      total_experience_years: parseExperienceYears(cellText(row, headers, "Total Experience")),
      current_company: cellText(row, headers, "Curr. Company name"),
      current_designation: cellText(row, headers, "Curr. Company Designation"),
      annual_salary_inr: parseSalaryInr(cellText(row, headers, "Annual Salary")),
      notice_period: cellText(row, headers, "Notice period/ Availability to join"),
      resume_headline: cellText(row, headers, "Resume Headline"),
      education_summary: educationSummary(row, headers),
      naukri_profile_url: profileUrl(row, headers),
      screening_answers: screeningAnswers(row, headers, email.raw && email.raw !== email.primary ? { _email_raw: email.raw } : {}),
    });
  }

  return { rows, skipped };
}
