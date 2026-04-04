// =============================================================================
// SMS-Shield Template Engine
// Simple mustache-like template engine for SMS message rendering
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TemplateContext {
  customer_name?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  discount_code?: string;
  store_name?: string;
  recovery_link?: string;
  cart_total?: string;
  cart_items_count?: number;
  order_name?: string;
  order_total?: string;
  confirmation_link?: string;
  custom?: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Regex patterns
// -----------------------------------------------------------------------------

/** Matches {{variable_name}} or {{custom.deep_value}} in templates */
const TEMPLATE_VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

/** Matches opening {{ without a closing }} — unclosed brace detection */
const UNCLOSED_BRACE_REGEX = /\{\{(?![^{]*\}\})/g;

/** Matches {{}} — empty variable name */
const EMPTY_VARIABLE_REGEX = /\{\{\s*\}\}/g;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Renders a mustache-like template by replacing `{{variable}}` placeholders
 * with values from the provided context object.
 *
 * Handles missing variables gracefully by replacing them with an empty string.
 * Supports nested custom fields via dot notation: `{{custom.deep_value}}`.
 *
 * @param template - The template string containing `{{variable}}` placeholders
 * @param context - Key-value pairs for variable substitution
 * @returns The rendered string with all variables replaced
 *
 * @example
 * ```ts
 * renderTemplate(
 *   "Hi {{customer_name}}, use code {{discount_code}} at {{store_name}}!",
 *   { customer_name: "Ahmed", discount_code: "SAVE10", store_name: "MyShop" }
 * )
 * // => "Hi Ahmed, use code SAVE10 at MyShop!"
 *
 * renderTemplate("Your cart total: {{cart_total}}", { store_name: "MyShop" })
 * // => "Your cart total: " (missing variable → empty string)
 *
 * renderTemplate("{{custom.coupon}}", { custom: { coupon: "VIP20" } })
 * // => "VIP20"
 * ```
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template || typeof template !== "string") {
    return template ?? "";
  }

  return template.replace(TEMPLATE_VARIABLE_REGEX, (_match, rawKey: string) => {
    const key = rawKey.trim();

    if (!key) {
      return "";
    }

    // Attempt dot-notation resolution for nested keys
    const value = resolveValue(context, key);

    if (value === undefined || value === null) {
      return "";
    }

    return String(value);
  });
}

/**
 * Extracts all unique variable names from a template string.
 *
 * @param template - The template string to scan
 * @returns A sorted array of unique variable names (trimmed)
 *
 * @example
 * ```ts
 * getTemplateVariables("Hi {{name}}, your code is {{code}}")
 * // => ["code", "name"]
 *
 * getTemplateVariables("{{custom.coupon}} for {{name}}")
 * // => ["custom.coupon", "name"]
 * ```
 */
export function getTemplateVariables(template: string): string[] {
  if (!template || typeof template !== "string") {
    return [];
  }

  const variables = new Set<string>();
  let match: RegExpExecArray | null;

  const regex = new RegExp(TEMPLATE_VARIABLE_REGEX.source, "g");
  while ((match = regex.exec(template)) !== null) {
    const key = match[1].trim();
    if (key) {
      variables.add(key);
    }
  }

  return Array.from(variables).sort();
}

/**
 * Validates a template string for structural issues.
 *
 * Checks:
 * - Unclosed braces (`{{` without a matching `}}`)
 * - Empty variable names (`{{}}`)
 * - Overall structural integrity
 *
 * @param template - The template string to validate
 * @returns Validation result with valid flag, extracted variables, and any errors
 *
 * @example
 * ```ts
 * validateTemplate("Hi {{name}}, {{}} is empty")
 * // => { valid: false, variables: ["name"], errors: ["Empty variable name at position 16"] }
 * ```
 */
export function validateTemplate(template: string): {
  valid: boolean;
  variables: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const variables = getTemplateVariables(template);

  // Check for unclosed braces
  UNCLOSED_BRACE_REGEX.lastIndex = 0;
  const unclosedMatches = template.match(UNCLOSED_BRACE_REGEX);
  if (unclosedMatches && unclosedMatches.length > 0) {
    for (const unclosed of unclosedMatches) {
      const position = template.indexOf(unclosed);
      errors.push(
        `Unclosed variable at position ${position}: "${unclosed}..."`
      );
    }
  }

  // Check for empty variable names
  EMPTY_VARIABLE_REGEX.lastIndex = 0;
  const emptyMatches = template.match(EMPTY_VARIABLE_REGEX);
  if (emptyMatches && emptyMatches.length > 0) {
    for (const emptyVar of emptyMatches) {
      const position = template.indexOf(emptyVar);
      errors.push(
        `Empty variable name at position ${position}: "{{}}"`
      );
    }
  }

  // Check for unopened closing braces (}} without preceding {{)
  const closeOnlyRegex = /(?<!\{\{)[^}]*\}\}/g;
  closeOnlyRegex.lastIndex = 0;
  const closeOnlyMatches = template.match(closeOnlyRegex);
  if (closeOnlyMatches && closeOnlyMatches.length > 0) {
    for (const closeOnly of closeOnlyMatches) {
      // Only flag if this doesn't overlap with a valid {{...}} pattern
      const idx = template.indexOf(closeOnly);
      if (idx > 0 && template[idx - 1] !== "}") {
        errors.push(
          `Unmatched closing braces at position ${idx}: "${closeOnly}"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    variables,
    errors,
  };
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

/**
 * Resolves a value from a context object using dot-notation path.
 * Supports one level of nesting (e.g., "custom.coupon" → context.custom?.coupon).
 * Also handles arrays and complex values by stringifying them.
 */
function resolveValue(context: TemplateContext, key: string): unknown {
  // Direct top-level key lookup
  if (key in context) {
    const directValue = (context as Record<string, unknown>)[key];
    return directValue;
  }

  // Dot-notation lookup (support one level deep)
  if (key.includes(".")) {
    const parts = key.split(".");
    if (parts.length === 2) {
      const [parentKey, childKey] = parts;
      const parent = (context as Record<string, unknown>)[parentKey];
      if (parent && typeof parent === "object" && !Array.isArray(parent)) {
        return (parent as Record<string, unknown>)[childKey];
      }
    }
  }

  return undefined;
}
