import type { UCLValue } from "../types.js";
import { UCLSyntaxError } from "../errors.js";
import { parseString, parseArray } from "./string-parser.js";

/**
 * Check if a value string represents a simple literal.
 */
export function isSimpleLiteral(valueStr: string): boolean {
 valueStr = valueStr.trim();

    // Quoted string literal - but only if it's a complete quoted string without operators
    if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))
    ) {
      // Check if this quoted string contains operators outside of the quotes
      // If it does, it's part of an expression, not a simple literal
      return !_containsOperators(valueStr);
    }

    // JSON array or object literal
    if (
      (valueStr.startsWith("[") && valueStr.endsWith("]")) ||
      (valueStr.startsWith("{") && valueStr.endsWith("}"))
    ) {
      try {
        // Attempt to parse as JSON to confirm it's a valid literal structure
        JSON.parse(valueStr);
        return true;
      } catch (e) {
        return false; // Not a valid JSON literal
      }
    }

    // Boolean or null literal (case-insensitive)
    if (["true", "false", "null"].includes(valueStr.toLowerCase())) {
      return true;
    }

    // Numeric literal
    // Ensure it's not just a part of a larger word or a reference
    if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
      return !isNaN(parseFloat(valueStr)) && isFinite(Number(valueStr));
    }

    return false;
}

/**
 * Helper function to check if a string contains operators outside of quotes.
 */
function _containsOperators(valueStr: string): boolean {
  // Define operators to check for (add more if needed)
  const operators = ['+', '-', '*', '/', '%', '=', '>', '<', '&', '|', '^', '~', '!', '?', ':'];
  // Remove the surrounding quotes
  const quoteChar = valueStr[0];
  const inner = valueStr.substring(1, valueStr.length - 1);
  // Check for operators outside the quotes (should not find any)
  return operators.some(op => inner.includes(op));
}

/**
 * Parse simple literal values.
 */
export function parseSimpleValue(
  valueStr: string,
  parseValueCallback: (value: string) => UCLValue,
): UCLValue {
  valueStr = valueStr.trim();

  if (valueStr.toLowerCase() === "null") {
    return null;
  }

  if (["true", "false"].includes(valueStr.toLowerCase())) {
    return valueStr.toLowerCase() === "true";
  }

  if (
    (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
    (valueStr.startsWith("'") && valueStr.endsWith("'"))
  ) {
    return parseString(valueStr.substring(1, valueStr.length - 1));
  }

  if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
    return parseArray(valueStr, parseValueCallback);
  }

  if (valueStr.startsWith("{") && valueStr.endsWith("}")) {
    try {
      return JSON.parse(valueStr);
    } catch (e: any) {
      throw new UCLSyntaxError(
        `Invalid JSON object: ${e.message} in '${valueStr}'`,
      );
    }
  }

  const num = Number(valueStr);
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }

  return valueStr;
}