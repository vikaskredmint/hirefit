import test from "node:test";
import assert from "node:assert/strict";
import { analyzeResumeText } from "../src/services/resume-analysis.js";

test("analyzes resume text contact and skill hints", () => {
  const result = analyzeResumeText(
    "Asha Rao asha@example.com +91 98765 43210 Enterprise sales, SaaS, BFSI, quota attainment.",
  );

  assert.equal(result.emails[0], "asha@example.com");
  assert.ok(result.phones.length >= 1);
  assert.ok(result.matched_skills.includes("enterprise sales"));
  assert.ok(result.matched_skills.includes("saas"));
  assert.ok(result.has_resume_text);
});
