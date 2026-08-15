export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.error("[PDF] Extraction failed:", err);
    throw new Error("Failed to extract text from PDF");
  }
}
