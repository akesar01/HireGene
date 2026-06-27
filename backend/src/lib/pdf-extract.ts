export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  } catch (err) {
    console.error("[PDF] Extraction failed:", err);
    throw new Error("Failed to extract text from PDF");
  }
}
