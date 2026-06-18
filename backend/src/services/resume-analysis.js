const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phonePattern = /(?:\+?\d[\s-]?){8,15}\d/g;

const skillHints = [
  "enterprise sales",
  "solution selling",
  "saas",
  "bfsi",
  "fintech",
  "loyalty",
  "customer engagement",
  "employee benefits",
  "cxo",
  "procurement",
  "revenue",
  "quota",
  "account management",
  "business development",
];

export function analyzeResumeText(text) {
  const source = text || "";
  const lower = source.toLowerCase();
  const words = source.split(/\s+/).filter(Boolean);
  const emails = Array.from(new Set(source.match(emailPattern) || [])).slice(0, 5);
  const phones = Array.from(new Set(source.match(phonePattern) || [])).slice(0, 5);
  const matched_skills = skillHints.filter((skill) => lower.includes(skill));

  return {
    word_count: words.length,
    character_count: source.length,
    emails,
    phones,
    matched_skills,
    has_resume_text: source.trim().length > 0,
  };
}
