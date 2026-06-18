import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { parseNaukriWorkbook, parseExperienceYears, parseSalaryInr } from "../src/services/xlsx-import.js";

test("parses Naukri hyperlinks and dynamic screening answers", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("export");
  sheet.addRow([
    "Job Title",
    "Name",
    "Email ID",
    "Phone Number",
    "Total Experience",
    "Annual Salary",
    "Candidate profile",
    "Ans(Notice buyout?)",
    "Ans(Has BFSI sales?)",
  ]);
  const row = sheet.addRow([
    "Enterprise Sales",
    "Asha Rao",
    "asha@example.com, alt@example.com",
    "9999999999",
    "9 Year(s) 6 Month(s)",
    "Rs 18 Lakhs",
    "View profile",
    "Yes",
    "Yes",
  ]);
  row.getCell(7).value = { text: "View profile", hyperlink: "https://naukri.example/profile/123" };

  const buffer = await workbook.xlsx.writeBuffer();
  const parsed = await parseNaukriWorkbook(Buffer.from(buffer), "Enterprise Sales");

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].naukri_profile_url, "https://naukri.example/profile/123");
  assert.equal(parsed.rows[0].screening_answers["Notice buyout?"], "Yes");
  assert.equal(parsed.rows[0].screening_answers["Has BFSI sales?"], "Yes");
  assert.equal(parsed.rows[0].screening_answers._email_raw, "asha@example.com, alt@example.com");
});

test("parses experience and salary fields", () => {
  assert.equal(parseExperienceYears("9 Year(s) 6 Month(s)"), 9.5);
  assert.equal(parseSalaryInr("Rs 18 Lakhs"), 1800000);
  assert.equal(parseSalaryInr("1.2 Cr"), 12000000);
});
