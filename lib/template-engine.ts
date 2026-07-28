import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface TemplateEngine {
  render(template: string, variables: Record<string, unknown>): string;
  validateVariables(template: string): string[];
  preview(template: string, sampleData: Record<string, unknown>): string;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function formatDate(value: unknown, formatStr: string): string {
  if (!value) return "";
  const date = typeof value === "string" ? parseISO(value) : value instanceof Date ? value : new Date(String(value));
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

function processConditionals(text: string, variables: Record<string, unknown>): string {
  const conditionalRegex = /\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)(?:\{\{\/if\}\}|\{\{#else\}\}([\s\S]*?)\{\{\/if\}\})/g;

  return text.replace(conditionalRegex, (_, conditionPath, trueBlock, falseBlock) => {
    const value = getNestedValue(variables, conditionPath);
    const isTruthy = value !== undefined && value !== null && value !== false && value !== "" && value !== 0;
    return isTruthy ? trueBlock : (falseBlock || "");
  });
}

function processExpressions(text: string, variables: Record<string, unknown>): string {
  const expressionRegex = /\{\{([^}]+)\}\}/g;

  return text.replace(expressionRegex, (match, expression: string) => {
    const trimmed = expression.trim();

    if (trimmed.startsWith("#if") || trimmed.startsWith("/if") || trimmed === "#else") {
      return match;
    }

    const formatMatch = trimmed.match(/^(\w+(?:\.\w+)*)(?:\s+format="([^"]+)")?$/);
    if (formatMatch) {
      const [, varPath, formatStr] = formatMatch;
      const value = getNestedValue(variables, varPath);

      if (value === undefined || value === null) return "";

      if (formatStr) {
        if (formatStr.startsWith("DD") || formatStr.startsWith("MM") || formatStr.startsWith("YYYY") || formatStr.startsWith("HH")) {
          return formatDate(value, formatStr);
        }
        if (formatStr === "currency") {
          return formatCurrency(value);
        }
        return String(value);
      }

      return String(value);
    }

    const value = getNestedValue(variables, trimmed);
    return value !== undefined && value !== null ? String(value) : "";
  });
}

export const templateEngine: TemplateEngine = {
  render(template: string, variables: Record<string, unknown>): string {
    let result = processConditionals(template, variables);
    result = processExpressions(result, variables);
    return result;
  },

  validateVariables(template: string): string[] {
    const variableRegex = /\{\{(\w+(?:\.\w+)*(?:\s+format="[^"]*")?)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const expression = match[1].trim();
      if (!expression.startsWith("#if") && !expression.startsWith("/if") && expression !== "#else") {
        const varName = expression.split(/\s+/)[0];
        variables.add(varName);
      }
    }

    return Array.from(variables);
  },

  preview(template: string, sampleData: Record<string, unknown>): string {
    return templateEngine.render(template, sampleData);
  },
};
