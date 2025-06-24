import type { UCLValue } from "../types.js";
import { UCLSyntaxError, UCLTypeError, UCLReferenceError } from "../errors.js";

/**
 * Tokenize an expression string into operands and operators.
 */
export function tokenizeExpression(expr: string): string[] {
  const tokens: string[] = [];
  let currentToken = "";
  let inString = false;
  let quoteChar: string | null = null;
  const operatorsAndParentheses = ["+", "-", "*", "/", "%", "(", ")"];

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (!inString && (char === '"' || char === "'")) {
      if (currentToken.trim() !== "") {
        tokens.push(currentToken.trim());
        currentToken = "";
      }
      currentToken = char;
      inString = true;
      quoteChar = char;
    } else if (inString && char === quoteChar) {
      if (i > 0 && expr[i - 1] === "\\") {
        currentToken += char;
      } else {
        currentToken += char;
        tokens.push(currentToken);
        currentToken = "";
        inString = false;
        quoteChar = null;
      }
    } else if (inString) {
      currentToken += char;
    } else if (
      char !== undefined &&
      operatorsAndParentheses.includes(char)
    ) {
      if (currentToken.trim() !== "") {
        tokens.push(currentToken.trim());
        currentToken = "";
      }
      tokens.push(char);
    } else if (char !== undefined && char.trim() === "") {
      if (currentToken.trim() !== "") {
        tokens.push(currentToken.trim());
        currentToken = "";
      }
    } else {
      currentToken += char;
    }
  }

  if (currentToken.trim() !== "") {
    tokens.push(currentToken.trim());
  }

  return tokens;
}

/**
 * Check if a token is an arithmetic operator.
 */
export function isOperator(token: string): boolean {
  return ["+", "-", "*", "/", "%"].includes(token);
}

/**
 * Convert a value to a number.
 */
export function toNumber(value: UCLValue): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const num = Number(value);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }
  }
  if (value === null) {
    return 0;
  }
  throw new UCLTypeError(`Cannot convert '${value}' to number`);
}

/**
 * Check if a string contains arithmetic operators outside quoted strings.
 */
export function containsOperators(valueStr: string): boolean {
  let inString = false;
  let quoteChar: string | null = null;

  for (let i = 0; i < valueStr.length; i++) {
    const char = valueStr[i];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      quoteChar = char;
    } else if (inString && char === quoteChar && valueStr[i - 1] !== "\\") {
      inString = false;
      quoteChar = null;
    } else if (
      !inString &&
      char !== undefined &&
      ["+", "-", "*", "/", "%"].includes(char)
    ) {
      return true;
    }
  }
  return false;
}