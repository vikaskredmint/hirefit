import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

export async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return (result.text || "").trim();
}

export async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "").trim();
}

export async function extractDocText(buffer) {
  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);
  return (document.getBody() || "").trim();
}

export function resumeFileKind(file) {
  const name = file.originalname.toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    mime.includes("wordprocessingml.document") ||
    name.endsWith(".docx")
  ) return "docx";
  if (mime.includes("msword") || name.endsWith(".doc")) return "doc";
  return null;
}

export async function extractResumeText(file) {
  const kind = resumeFileKind(file);
  if (kind === "pdf") return extractPdfText(file.buffer);
  if (kind === "docx") return extractDocxText(file.buffer);
  if (kind === "doc") return extractDocText(file.buffer);
  throw new Error("Only PDF, DOC, and DOCX resumes are supported");
}
