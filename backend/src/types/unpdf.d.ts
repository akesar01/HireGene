declare module "unpdf" {
  export function getDocumentProxy(data: Uint8Array): Promise<any>;
  export function extractText(pdf: any, opts?: { mergePages?: boolean }): Promise<{ text: string }>;
}
