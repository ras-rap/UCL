import type { UCLValue, UCLArray } from "../types.js";
import { UCLSyntaxError } from "../errors.js";

/**
 * Parse string content, handling common escape sequences.
 */
export function parseString(s: string): string {
  const escapeSequences: { [key: string]: string } = {
    n: "\n",
    t: "\t",
    r: "\r",
    "\\": "\\",
    '"': '"',
    "'": "'",
  };

  let result = "";
  let i = 0;
  while (i < s.length) {
    const char = s[i];
    if (char === "\\" && i + 1 < s.length) {
      const nextChar = s[i + 1];
      if (nextChar !== undefined && escapeSequences[nextChar] !== undefined) {
        result += escapeSequences[nextChar];
        i += 2;
      } else {
        result += char;
        i++;
      }
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

/**
 * Parse array values from a string, supporting nested structures.
 */
export function parseArray(
  arrayStr: string,
  parseValue: (value: string) => UCLValue,
): UCLArray {
  const content = arrayStr.substring(1, arrayStr.length - 1).trim();

  if (!content) {
    return [];
  }

  const cleanedContent = content.replace(/\s*\n\s*/g, " ");
  const elements: UCLValue[] = [];
  let currentElement = "";
  let bracketCount = 0;
  let braceCount = 0;
  let inString = false;
  let quoteChar: string | null = null;
  let i = 0;

  while (i < cleanedContent.length) {
    const char = cleanedContent[i];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      quoteChar = char;
      currentElement += char;
    } else if (inString && char === quoteChar) {
      if (i > 0 && cleanedContent[i - 1] === "\\") {
        currentElement += char;
      } else {
        inString = false;
        quoteChar = null;
        currentElement += char;
      }
    } else if (!inString) {
      if (char === "[") {
        bracketCount++;
        currentElement += char;
      } else if (char === "]") {
        bracketCount--;
        currentElement += char;
      } else if (char === "{") {
        braceCount++;
        currentElement += char;
      } else if (char === "}") {
        braceCount--;
        currentElement += char;
      } else if (char === "," && bracketCount === 0 && braceCount === 0) {
        if (currentElement.trim() !== "") {
          elements.push(parseValue(currentElement.trim()));
        }
        currentElement = "";
      } else {
        currentElement += char;
      }
    } else {
      currentElement += char;
    }
    i++;
  }

  if (currentElement.trim() !== "") {
    elements.push(parseValue(currentElement.trim()));
  }
  return elements;
}

/**
 * Removes single-line (//) and multi-line comments from content.
 */
export function removeComments(content: string): string {
  content = content.replace(/\/\*.*?\*\//gs, "");

  const lines = content.split("\n");
  const cleanedLines: string[] = [];

  for (let line of lines) {
    let inString = false;
    let quoteChar: string | null = null;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        quoteChar = char;
      } else if (inString && char === quoteChar && line[i - 1] !== "\\") {
        inString = false;
        quoteChar = null;
      } else if (
        !inString &&
        char === "/" &&
        i + 1 < line.length &&
        line[i + 1] === "/"
      ) {
        line = line.substring(0, i);
        break;
      }
      i++;
    }
    cleanedLines.push(line);
  }
  return cleanedLines.join("\n");
}