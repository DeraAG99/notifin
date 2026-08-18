import type { ParseResult } from "./types";
import { parseTable, type TableMapping } from "./engines/table";
import { ekinerjaHtmlParser } from "./parsers/ekinerja/html";
import { ekinerjaXlsxParser } from "./parsers/ekinerja/xlsx";
import { pdukpdxlsxParser } from "./parsers/pdukpdxlsx";

export interface ImportTypeConfig {
  id: string;
  key: string;
  name: string;
  engine: string;
  format: string;
  detectRules: string[];
  columnMapping: Record<string, unknown> | null;
  isActive: boolean | null;
}

export function detectImportType(
  types: ImportTypeConfig[],
  content: string
): ImportTypeConfig | null {
  const lower = content.toLowerCase();
  for (const t of types) {
    if (!t.isActive) continue;
    if (!t.detectRules || t.detectRules.length === 0) continue;
    if (t.detectRules.every((r) => lower.includes(r.toLowerCase()))) return t;
  }
  return null;
}

export function detectXlsxImportType(
  types: ImportTypeConfig[],
  headerText: string
): ImportTypeConfig | null {
  return detectImportType(
    types.filter((t) => t.format === "xlsx"),
    headerText
  );
}

export async function parseWithType(
  type: ImportTypeConfig,
  content: string | ArrayBuffer
): Promise<ParseResult> {
  if (type.engine === "ekinerja-json") {
    const parser = type.format === "xlsx" ? ekinerjaXlsxParser : ekinerjaHtmlParser;
    return parser.parse(content);
  }

  if (type.engine === "pdukpdxlsx") {
    return pdukpdxlsxParser.parse(content);
  }

  const mapping = (type.columnMapping as unknown as TableMapping) || null;
  if (!mapping) {
    return {
      items: [],
      errors: ["Mapping kolom belum dikonfigurasi untuk tipe ini."],
    };
  }
  return parseTable(content, mapping);
}
