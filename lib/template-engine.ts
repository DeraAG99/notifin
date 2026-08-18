import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface TemplateEngine {
  render(template: string, variables: Record<string, unknown>): string;
  validateVariables(template: string): string[];
  preview(template: string, sampleData: Record<string, unknown>): string;
}

type Node =
  | { type: "text"; value: string }
  | { type: "expr"; path: string; format?: string }
  | { type: "if"; path: string; then: Node[]; else: Node[] }
  | { type: "each"; path: string; body: Node[] };

type Scope = Record<string, unknown>;

function parseNodes(
  text: string,
  pos: number
): { nodes: Node[]; pos: number; stoppedTag: string | null } {
  const nodes: Node[] = [];

  while (pos < text.length) {
    const open = text.indexOf("{{", pos);
    if (open === -1) {
      nodes.push({ type: "text", value: text.slice(pos) });
      pos = text.length;
      break;
    }

    if (open > pos) {
      nodes.push({ type: "text", value: text.slice(pos, open) });
    }

    const close = text.indexOf("}}", open);
    if (close === -1) {
      nodes.push({ type: "text", value: text.slice(open) });
      pos = text.length;
      break;
    }

    const tag = text.slice(open + 2, close).trim();
    pos = close + 2;

    if (tag === "#else" || tag === "/if" || tag === "/each") {
      return { nodes, pos, stoppedTag: tag };
    }

    if (tag.startsWith("#if")) {
      const path = tag.slice(3).trim();
      const thenRes = parseNodes(text, pos);
      const thenNodes = thenRes.nodes;
      let elseNodes: Node[] = [];
      let cursor = thenRes.pos;

      if (thenRes.stoppedTag === "#else") {
        const elseRes = parseNodes(text, thenRes.pos);
        elseNodes = elseRes.nodes;
        cursor = elseRes.pos;
      }

      nodes.push({ type: "if", path, then: thenNodes, else: elseNodes });
      pos = cursor;
      continue;
    }

    if (tag.startsWith("#each")) {
      const path = tag.slice(5).trim();
      const bodyRes = parseNodes(text, pos);
      nodes.push({ type: "each", path, body: bodyRes.nodes });
      pos = bodyRes.pos;
      continue;
    }

    const fmtMatch = tag.match(/^(.*?)\s+format="([^"]*)"$/);
    if (fmtMatch) {
      nodes.push({ type: "expr", path: fmtMatch[1].trim(), format: fmtMatch[2] });
    } else {
      nodes.push({ type: "expr", path: tag });
    }
  }

  return { nodes, pos, stoppedTag: null };
}

function lookup(path: string, scope: Scope[]): unknown {
  if (path === "@index" || path === "@number" || path === "this") {
    for (const s of scope) {
      if (s && typeof s === "object" && path in s) return s[path];
    }
    return undefined;
  }

  const parts = path.split(".");
  for (const s of scope) {
    if (s && typeof s === "object" && parts[0] in s) {
      let current: unknown = s;
      for (const part of parts) {
        if (
          current &&
          typeof current === "object" &&
          part in (current as Record<string, unknown>)
        ) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      return current;
    }
  }
  return undefined;
}

function formatDate(value: unknown, formatStr: string): string {
  if (!value) return "";
  const date =
    typeof value === "string"
      ? parseISO(value)
      : value instanceof Date
        ? value
        : new Date(String(value));
  if (isNaN(date.getTime())) return String(value);
  return format(date, formatStr, { locale: idLocale });
}

function formatCurrency(value: unknown): string {
  if (value === null || value === undefined) return "";
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function renderExpr(node: { path: string; format?: string }, scope: Scope[]): string {
  const value = lookup(node.path, scope);
  if (value === undefined || value === null) return "";

  if (node.format) {
    const f = node.format;
    if (
      f.startsWith("DD") ||
      f.startsWith("MM") ||
      f.startsWith("YYYY") ||
      f.startsWith("HH")
    ) {
      return formatDate(value, f);
    }
    if (f === "currency") {
      return formatCurrency(value);
    }
    return String(value);
  }

  return String(value);
}

function isTruthy(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false && value !== "" && value !== 0;
}

function renderNodes(nodes: Node[], scope: Scope[]): string {
  let out = "";

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out += node.value;
        break;
      case "expr":
        out += renderExpr(node, scope);
        break;
      case "if": {
        const value = lookup(node.path, scope);
        out += renderNodes(isTruthy(value) ? node.then : node.else, scope);
        break;
      }
      case "each": {
        const value = lookup(node.path, scope);
        if (Array.isArray(value)) {
          value.forEach((item, idx) => {
            let itemScope: Scope;
            if (item && typeof item === "object") {
              itemScope = {
                ...(item as Scope),
                "@index": idx,
                "@number": idx + 1,
                this: item,
              };
            } else {
              itemScope = { this: item, "@index": idx, "@number": idx + 1 };
            }
            out += renderNodes(node.body, [itemScope, ...scope]);
          });
        }
        break;
      }
    }
  }

  return out;
}

function collectExprPaths(nodes: Node[], acc: Set<string>): void {
  for (const node of nodes) {
    switch (node.type) {
      case "expr":
        if (!node.path.startsWith("@") && node.path !== "this") {
          acc.add(node.path);
        }
        break;
      case "if":
        collectExprPaths(node.then, acc);
        collectExprPaths(node.else, acc);
        break;
      case "each":
        collectExprPaths(node.body, acc);
        break;
    }
  }
}

export const templateEngine: TemplateEngine = {
  render(template: string, variables: Record<string, unknown>): string {
    const { nodes } = parseNodes(template, 0);
    return renderNodes(nodes, [variables]);
  },

  validateVariables(template: string): string[] {
    const { nodes } = parseNodes(template, 0);
    const acc = new Set<string>();
    collectExprPaths(nodes, acc);
    return Array.from(acc);
  },

  preview(template: string, sampleData: Record<string, unknown>): string {
    return templateEngine.render(template, sampleData);
  },
};
