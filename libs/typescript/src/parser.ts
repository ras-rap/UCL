import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

// 1. Define Custom Errors
class UCLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UCLError";
  }
}

class UCLSyntaxError extends UCLError {
  constructor(message: string) {
    super(message);
    this.name = "UCLSyntaxError";
  }
}

class UCLReferenceError extends UCLError {
  constructor(message: string) {
    super(message);
    this.name = "UCLReferenceError";
  }
}

class UCLTypeError extends UCLError {
  constructor(message: string) {
    super(message);
    this.name = "UCLTypeError";
  }
}

// Adjusted UCLValue and UCLObject for better type inference and access
type UCLValue = string | number | boolean | null | UCLArray | UCLObject;
type UCLArray = UCLValue[];
interface UCLObject {
  [key: string]: UCLValue;
}

// 2. Define the UCLParser Class
class UCLParser {
  private config: UCLObject = {};
  private currentSection: string[] = [];
  private defaults: UCLObject = {};
  private envVars: { [key: string]: string | undefined } = { ...process.env };
  private basePath: string = process.cwd();

  constructor() {}

  /**
   * Parses a UCL file and returns the configuration object.
   * @param filepath The path to the UCL file.
   * @returns The parsed configuration as an object.
   * @throws {UCLError} For any errors encountered during parsing.
   * @throws {FileNotFoundError} If the specified file does not exist.
   */
  public parseFile(filepath: string): UCLObject {
    const fullPath = resolve(filepath);
    this.basePath = dirname(fullPath);

    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    const content = readFileSync(fullPath, "utf-8");
    return this.parseString(content);
  }

  /**
   * Parses UCL content from a string.
   * @param content The UCL content as a string.
   * @returns The parsed configuration as an object.
   * @throws {UCLError} For any errors encountered during parsing.
   */
  public parseString(content: string): UCLObject {
    this.config = {};
    this.currentSection = [];
    this.defaults = {};

    content = this._removeComments(content);
    let lines = content.split("\n");

    lines = this._processIncludes(lines);

    this._parseLines(lines);

    this._applyDefaults();

    return this.config;
  }

  /**
   * Removes single-line (//) and multi-line (/* ... *) comments from the content.
   */
  private _removeComments(content: string): string {
    // Remove multi-line comments first
    content = content.replace(/\/\*.*?\*\//gs, ""); // 's' flag for DOTALL

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
          line = line.substring(0, i); // Remove rest of the line
          break;
        }
        i++;
      }
      cleanedLines.push(line);
    }
    return cleanedLines.join("\n");
  }

  /**
   * Processes 'include' directives in the UCL content.
   * Replaces `include "path/to/file.ucl"` lines with the content of the included files.
   * Includes are processed recursively.
   * @param lines A list of lines from the UCL content.
   * @returns A new list of lines with included content integrated.
   * @throws {UCLError} If an included file is not found.
   * @throws {UCLSyntaxError} If the include syntax is invalid.
   */
  private _processIncludes(lines: string[]): string[] {
    const processedLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("include ")) {
        const match = trimmedLine.match(/^include\s+["']([^"']+)["']$/);
        if (match) {
          const includePath = match[1];
          // `match[1]` is always a string if match is not null, so no need for `typeof includePath !== "string"`
          const fullPath = resolve(this.basePath, includePath as string);

          if (existsSync(fullPath)) {
            const includeContent = readFileSync(fullPath, "utf-8");
            // Recursively process includes in the included file
            const cleanedIncludeContent = this._removeComments(includeContent);
            const includeLines = cleanedIncludeContent.split("\n");
            processedLines.push(...this._processIncludes(includeLines));
          } else {
            throw new UCLError(`Include file not found: ${includePath}`);
          }
        } else {
          throw new UCLSyntaxError(`Invalid include syntax: ${line}`);
        }
      } else {
        processedLines.push(line);
      }
    }
    return processedLines;
  }

  /**
   * Parses the UCL lines, handling sections and key-value pairs.
   */
  private _parseLines(lines: string[]): void {
    let i = 0;
    while (i < lines.length) {
      const line = (lines[i] ?? "").trim(); // Use nullish coalescing for safety

      if (!line) {
        i++;
        continue;
      }

      if (line.startsWith("[") && line.endsWith("]")) {
        const sectionName = line.substring(1, line.length - 1).trim();

        if (sectionName.toLowerCase() === "defaults") {
          // Defaults section must be parsed to the end
          i = this._parseDefaultsSection(lines, i + 1);
          // Once defaults are parsed, there should be no more config
          break;
        } else {
          this.currentSection = sectionName.split(".");
          i++;
        }
      } else {
        i = this._parseKeyValue(lines, i);
      }
    }
  }

  /**
   * Parses the 'defaults' section of the UCL file.
   * @param lines All lines from the UCL content.
   * @param startIdx The starting index for parsing the defaults section.
   * @returns The index of the last line processed in the defaults section.
   * @throws {UCLSyntaxError} If a new section is encountered within the defaults section.
   */
  private _parseDefaultsSection(lines: string[], startIdx: number): number {
    let i = startIdx;

    while (i < lines.length) {
      const line = (lines[i] ?? "").trim(); // Use nullish coalescing for safety

      if (!line) {
        i++;
        continue;
      }

      if (line.startsWith("[") && line.endsWith("]")) {
        throw new UCLSyntaxError(
          "Defaults section must be at the end of the file",
        );
      }

      if (line.includes("=")) {
        const [key, valuePart] = this._splitKeyValue(line);
        this.defaults[key] = this._parseValue(valuePart);
      }
      i++;
    }
    return i;
  }

  /**
   * Parses a key-value pair, handling potential multi-line values (JSON objects/arrays).
   * @param lines All lines from the UCL content.
   * @param startIdx The starting index for parsing the key-value pair.
   * @returns The index of the next line to process after parsing the current key-value pair.
   * @throws {UCLSyntaxError} If the line has invalid syntax for a key-value pair.
   */
  private _parseKeyValue(lines: string[], startIdx: number): number {
    const line = (lines[startIdx] ?? "").trim(); // Use nullish coalescing for safety

    if (!line.includes("=")) {
      // This case handles lines that are not key-value but might be part of
      // a multi-line structure or just empty/comments already removed.
      // If it's not an empty line, section, or json-like structure, it's an error.
      if (
        line &&
        !line.startsWith("[") &&
        !line.endsWith("]") &&
        !["{", "}"].includes(line)
      ) {
        // Check for characters that indicate it might be part of a JSON structure
        if (!/[\[\]\{\}\,\"\']/.test(line)) {
          throw new UCLSyntaxError(
            `Invalid syntax: line without equals sign: ${line}`,
          );
        }
      }
      return startIdx + 1;
    }

    const [key, valuePart] = this._splitKeyValue(line);

    // Check if the value starts a multi-line JSON object or array
    if (valuePart.trim().startsWith("{") || valuePart.trim().startsWith("[")) {
      const [valueStr, endIdx] = this._parseMultilineValue(
        lines,
        startIdx,
        valuePart,
      );
      const value = this._parseValue(valueStr);
      this._setNestedValue(key, value);
      return endIdx + 1;
    } else {
      const value = this._parseValue(valuePart);
      this._setNestedValue(key, value);
      return startIdx + 1;
    }
  }

  /**
   * Splits a line into key and value parts, respecting quoted strings.
   * Ensures that an '=' sign within a quoted string does not split the key-value.
   * @param line The line containing the key-value pair.
   * @returns A tuple [string, string] where both are strings.
   * @throws {UCLSyntaxError} If no valid '=' separator is found.
   */
  private _splitKeyValue(line: string): [string, string] {
    let inString = false;
    let quoteChar: string | null = null;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        quoteChar = char;
      } else if (inString && char === quoteChar && line[i - 1] !== "\\") {
        // Handle escaped quotes
        inString = false;
        quoteChar = null;
      } else if (!inString && char === "=") {
        const key = line.substring(0, i).trim();
        const value = line.substring(i + 1).trim();
        return [key, value];
      }
    }
    throw new UCLSyntaxError(`Invalid key-value syntax: ${line}`);
  }

  /**
   * Parses multi-line JSON objects and arrays by counting braces/brackets.
   * @param lines All lines from the UCL content.
   * @param startIdx The starting line index where the multi-line value begins.
   * @param initialValue The content of the first line of the multi-line value.
   * @returns A tuple containing [fullValueString, endIndex] where fullValueString is the complete multi-line value, and endIndex is the line number where the multi-line value ends.
   */
  private _parseMultilineValue(
    lines: string[],
    startIdx: number,
    initialValue: string,
  ): [string, number] {
    let valueStr = initialValue.trim();
    let i = startIdx + 1;

    if (valueStr.startsWith("{")) {
      let braceCount =
        (valueStr.match(/{/g)?.length || 0) -
        (valueStr.match(/}/g)?.length || 0);

      while (i < lines.length && braceCount > 0) {
        const line = (lines[i] ?? "").trim(); // Use nullish coalescing for safety
        if (line) {
          valueStr += "\n" + line;
          braceCount +=
            (line.match(/{/g)?.length || 0) - (line.match(/}/g)?.length || 0);
        }
        i++;
      }
      return [valueStr, i - 1]; // Return the index of the last line of the value
    } else if (valueStr.startsWith("[")) {
      let bracketCount =
        (valueStr.match(/\[/g)?.length || 0) -
        (valueStr.match(/\]/g)?.length || 0);

      while (i < lines.length && bracketCount > 0) {
        const line = (lines[i] ?? "").trim(); // Use nullish coalescing for safety
        if (line) {
          valueStr += "\n" + line;
          bracketCount +=
            (line.match(/\[/g)?.length || 0) -
            (line.match(/\]/g)?.length || 0);
        }
        i++;
      }
      return [valueStr, i - 1]; // Return the index of the last line of the value
    }
    return [initialValue, startIdx];
  }

  /**
   * Parses a value string into the appropriate JavaScript type.
   * This is the primary method for parsing a value from a UCL line.
   * It handles expressions, type conversions, environment variables,
   * variable references, and simple literals.
   * @param valueStr The string representation of the value.
   * @returns The parsed value in its native JavaScript type.
   * @throws {UCLReferenceError} If a variable reference cannot be resolved.
   * @throws {UCLTypeError} If a type conversion fails.
   * @throws {UCLSyntaxError} If JSON parsing fails for array/object literals.
   */
  private _parseValue(valueStr: string): UCLValue {
    valueStr = valueStr.trim();

    if (!valueStr) {
      return null;
    }

    // 1. Environment variable resolution
    const envMatch = valueStr.match(/^\$ENV\{([^}]+)\}$/);
    if (envMatch) {
      const envVar = envMatch[1];
      if (typeof envVar === "string") {
        return this.envVars[envVar] ?? null; // Coerce undefined to null
      }
      return null;
    }

    // 2. Explicit type conversion (e.g., "123.int", "4.5.string")
    // Check for type conversion suffix. This must come BEFORE expression evaluation
    // and reference resolution, as it modifies the base value.
    if (valueStr.includes(".") && !this._isSimpleLiteral(valueStr)) {
      const parts = valueStr.split(".");
      // Ensure there's a suffix part that looks like a type conversion
      if (parts.length > 1) {
        const typeSuffix = parts[parts.length - 1]; // Last part is potential type
        const baseValueStr = parts.slice(0, parts.length - 1).join(".");

        if (
          typeof typeSuffix === "string" &&
          ["int", "float", "string", "bool"].includes(typeSuffix.toLowerCase())
        ) {
          // Recursively parse the base value, which might be an expression or reference
          const baseValue = this._parseValue(baseValueStr);
          return this._convertType(baseValue, typeSuffix.toLowerCase());
        }
      }
    }

    // 3. Arithmetic expressions and string concatenation
    // This comes after type conversion because "10.string + 5" should first convert to string, then concatenate.
    if (this._containsOperators(valueStr) && !this._isSimpleLiteral(valueStr)) {
      return this._evaluateExpression(valueStr);
    }

    // 4. Variable reference resolution (must come after simple literal check and expression check)
    // Only attempt to resolve if it looks like a variable reference and not a simple literal.
    // We already handled complex references in _evaluateExpression.
    if (!this._isSimpleLiteral(valueStr) && this._isVariableReference(valueStr)) {
      return this._resolveReference(valueStr);
    }

    // 5. Simple literal parsing (strings, numbers, booleans, null, arrays, objects)
    return this._parseSimpleValue(valueStr);
  }

  /**
   * Check if a string contains arithmetic operators (+, -, *, /, %) outside of quoted strings.
   */
  private _containsOperators(valueStr: string): boolean {
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

  /**
   * Check if a value string represents a simple literal (string, number, boolean, null, array, object).
   */
  private _isSimpleLiteral(valueStr: string): boolean {
    valueStr = valueStr.trim();

    // Quoted string literal - but only if it's a complete quoted string without operators
    if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))
    ) {
      // Check if this quoted string contains operators outside of the quotes
      // If it does, it's part of an expression, not a simple literal
      return !this._containsOperators(valueStr);
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
   * Parse simple literal values (strings, numbers, booleans, null, arrays, objects).
   * @param valueStr The string to parse.
   * @returns The parsed value (string, number, boolean, Array, object, null).
   * @throws {UCLSyntaxError} If JSON array or object parsing fails.
   */
  private _parseSimpleValue(valueStr: string): UCLValue {
    valueStr = valueStr.trim();

    if (valueStr.toLowerCase() === "null") {
      return null;
    }

    if (["true", "false"].includes(valueStr.toLowerCase())) {
      return valueStr.toLowerCase() === "true";
    }

    // Strings with quotes
    if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))
    ) {
      return this._parseString(valueStr.substring(1, valueStr.length - 1));
    }

    // Arrays (handled as UCL-specific array parsing)
    if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
      return this._parseArray(valueStr);
    }

    // Objects (parsed as JSON)
    if (valueStr.startsWith("{") && valueStr.endsWith("}")) {
      try {
        return JSON.parse(valueStr);
      } catch (e: any) {
        throw new UCLSyntaxError(
          `Invalid JSON object: ${e.message} in '${valueStr}'`,
        );
      }
    }

    // Numbers (int or float)
    const num = Number(valueStr);
    if (!isNaN(num) && isFinite(num)) {
      return num;
    }

    // If none of the above, treat as a plain string
    return valueStr;
  }

  /**
   * Parse string content, handling common escape sequences.
   */
  private _parseString(s: string): string {
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
      const char = s[i]; // No longer possibly undefined, as s is a string
      if (char === "\\" && i + 1 < s.length) {
        const nextChar = s[i + 1];
        if (nextChar !== undefined && escapeSequences[nextChar] !== undefined) {
          // Check if defined in map
          result += escapeSequences[nextChar];
          i += 2; // Skip backslash and the escaped character
        } else {
          // Keep the backslash if it's not a recognized escape
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
   * Parse array values from a string, supporting nested structures and proper
   * splitting by commas outside of nested objects/arrays/strings.
   * @param arrayStr The string representation of the array (e.g., "[1, 2, 'a']").
   * @returns The parsed list of elements.
   */
  private _parseArray(arrayStr: string): UCLArray {
    const content = arrayStr.substring(1, arrayStr.length - 1).trim(); // Remove outer brackets

    if (!content) {
      return [];
    }

    // Replace newlines with spaces within the content for easier tokenization
    const cleanedContent = content.replace(/\s*\n\s*/g, " ");

    const elements: UCLValue[] = [];
    let currentElement = "";
    let bracketCount = 0; // To track nested arrays
    let braceCount = 0; // To track nested objects
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
          // It's an escaped quote within a string, keep it
          currentElement += char;
        } else {
          // End of string literal
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
          // Only split by comma if not inside a nested structure or string
          if (currentElement.trim() !== "") {
            elements.push(this._parseValue(currentElement.trim()));
          }
          currentElement = "";
        } else {
          currentElement += char;
        }
      } else {
        // Inside a string, just append the character
        currentElement += char;
      }
      i++;
    }

    // Add the last element if any
    if (currentElement.trim() !== "") {
      elements.push(this._parseValue(currentElement.trim()));
    }
    return elements;
  }

  /**
   * Evaluate arithmetic expressions and string concatenations, respecting operator precedence.
   * Supports basic arithmetic (+, -, *, /, %) and string concatenation (+).
   * Handles parentheses for grouping.
   * @param expr The expression string.
   * @returns The result of the evaluation (number or string).
   * @throws {UCLTypeError} If operands are incompatible for an operation.
   * @throws {UCLReferenceError} If a reference within the expression cannot be resolved.
   */
  private _evaluateExpression(expr: string): UCLValue {
    // First, evaluate expressions within parentheses recursively
    while (expr.includes("(")) {
      const start = expr.lastIndexOf("(");
      if (start === -1) {
        break; // No more opening parentheses found
      }

      let end = -1;
      let openCount = 0;
      for (let i = start; i < expr.length; i++) {
        if (expr[i] === "(") {
          openCount++;
        } else if (expr[i] === ")") {
          openCount--;
        }
        if (openCount === 0 && expr[i] === ")") {
          end = i;
          break;
        }
      }

      if (end === -1) {
        throw new UCLSyntaxError(
          `Mismatched parentheses in expression: ${expr}`,
        );
      }

      const innerExpr = expr.substring(start + 1, end);
      const result = this._evaluateSimpleExpression(innerExpr);
      expr =
        expr.substring(0, start) + String(result) + expr.substring(end + 1);
    }

    // Finally, evaluate the simplified expression (no parentheses)
    return this._evaluateSimpleExpression(expr);
  }

  /**
   * Evaluate a simple expression (without parentheses) respecting operator precedence.
   * Order of operations: *, /, % then +, - (including string concatenation).
   * @param expr The expression string without parentheses.
   * @returns The result of the evaluation.
   */
  private _evaluateSimpleExpression(expr: string): UCLValue {
    // Tokenize the expression
    const rawTokens = this._tokenizeExpression(expr);

    // Pass 1: Resolve all non-operator tokens to their actual values
    let evaluatedTokens: UCLValue[] = [];
    for (const rawToken of rawTokens) {
      if (this._isOperator(rawToken)) {
        evaluatedTokens.push(rawToken);
      } else {
        // Resolve environment variables, variable references, and parse literals
        // This helper ensures we get the actual value, not a string representation of it.
        evaluatedTokens.push(this._resolveOperand(rawToken));
      }
    }

    // Pass 2: Handle multiplication, division, and modulo
    let processedTokens: UCLValue[] = [];
    for (let i = 0; i < evaluatedTokens.length; i++) {
      const token = evaluatedTokens[i];
      if (token === "*" || token === "/" || token === "%") {
        const leftToken = processedTokens.pop();
        if (leftToken === undefined) {
          throw new UCLSyntaxError(
            "Missing left operand for operator '" + token + "'",
          );
        }
        const left = this._toNumber(leftToken);
        const rightToken = evaluatedTokens[++i];
        if (rightToken === undefined) {
          throw new UCLSyntaxError(
            "Missing right operand for operator '" + token + "'",
          );
        }
        const right = this._toNumber(rightToken);

        let result: number;
        if (token === "*") {
          result = left * right;
        } else if (token === "/") {
          if (right === 0) {
            throw new UCLTypeError("Division by zero");
          }
          result = left / right;
        } else {
          // Modulo
          if (right === 0) {
            throw new UCLTypeError("Modulo by zero");
          }
          result = left % right;
        }
        processedTokens.push(result);
      } else {
        if (token !== undefined) {
          processedTokens.push(token);
        }
      }
    }
    evaluatedTokens = processedTokens; // Update tokens after first pass

    // Pass 3: Handle addition and subtraction
    processedTokens = [];
    for (let i = 0; i < evaluatedTokens.length; i++) {
      const token = evaluatedTokens[i];
      if (token === "+" || token === "-") {
        const left = processedTokens.pop();
        const right = evaluatedTokens[++i];

        let result: UCLValue;
        if (token === "+") {
          // String concatenation if either operand is a string
          if (typeof left === "string" || typeof right === "string") {
            result = String(left) + String(right);
          } else {
            if (left === undefined || right === undefined) {
              throw new UCLTypeError("Operand is undefined in addition");
            }
            result = this._toNumber(left) + this._toNumber(right);
          }
        } else {
          // Subtraction
          if (left === undefined || right === undefined) {
            throw new UCLTypeError("Operand is undefined in subtraction");
          }
          result = this._toNumber(left) - this._toNumber(right);
        }
        processedTokens.push(result);
      } else {
        if (token !== undefined) {
          processedTokens.push(token);
        }
      }
    }
    evaluatedTokens = processedTokens; // Final tokens array

    // The result should be the single remaining token
    return evaluatedTokens[0] !== undefined ? evaluatedTokens[0] : null;
  }

  /**
   * Tokenize an expression string into a list of operands and operators.
   * Handles quoted strings as single tokens. Operators and parentheses are
   * also treated as individual tokens.
   * @param expr The expression string.
   * @returns A list of tokens.
   */
  /**
   * Tokenize an expression string into a list of operands and operators.
   * Handles quoted strings as single tokens. Operators and parentheses are
   * also treated as individual tokens.
   * @param expr The expression string.
   * @returns A list of tokens.
   */
  private _tokenizeExpression(expr: string): string[] {
    const tokens: string[] = [];
    let currentToken = "";
    let inString = false;
    let quoteChar: string | null = null;
    const operatorsAndParentheses = ["+", "-", "*", "/", "%", "(", ")"];

    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];

      if (!inString && (char === '"' || char === "'")) {
        // Start of a quoted string
        if (currentToken.trim() !== "") {
          tokens.push(currentToken.trim());
          currentToken = "";
        }
        currentToken = char; // Keep the quote as part of the token
        inString = true;
        quoteChar = char;
      } else if (inString && char === quoteChar) {
        // End of a quoted string (handle escaped quotes by checking previous char)
        if (i > 0 && expr[i - 1] === "\\") {
          currentToken += char; // It's an escaped quote, keep it in string
        } else {
          currentToken += char; // Keep the quote as part of the token
          tokens.push(currentToken);
          currentToken = "";
          inString = false;
          quoteChar = null;
        }
      } else if (inString) {
        // Inside a string, just append the character
        currentToken += char;
      } else if (
        char !== undefined &&
        operatorsAndParentheses.includes(char)
      ) {
        // Operator or parenthesis encountered outside a string
        if (currentToken.trim() !== "") {
          tokens.push(currentToken.trim());
          currentToken = "";
        }
        tokens.push(char);
      } else if (char !== undefined && char.trim() === "") {
        // Whitespace outside a string, finalize current token
        if (currentToken.trim() !== "") {
          tokens.push(currentToken.trim());
          currentToken = "";
        }
      } else {
        // Regular character, append to current token
        currentToken += char;
      }
    }

    if (currentToken.trim() !== "") {
      tokens.push(currentToken.trim());
    }

    return tokens;
  }

  /**
   * Resolves a single operand string from an expression.
   * This is used by _evaluateSimpleExpression to get the actual value of a token.
   * It handles quoted strings, environment variables, and variable references.
   * It does NOT perform full expression evaluation or type conversion suffixes.
   * @param operandStr The string representation of the operand.
   * @returns The resolved operand value.
   * @throws {UCLReferenceError} If a variable reference cannot be resolved.
   */
  private _resolveOperand(operandStr: string): UCLValue {
    operandStr = operandStr.trim();

    if (!operandStr) {
      return null;
    }

    // 1. Quoted string literal (handle directly to remove quotes)
    if (
      (operandStr.startsWith('"') && operandStr.endsWith('"')) ||
      (operandStr.startsWith("'") && operandStr.endsWith("'"))
    ) {
      return this._parseString(operandStr.substring(1, operandStr.length - 1));
    }

    // 2. Environment variable resolution
    const envMatch = operandStr.match(/^\$ENV\{([^}]+)\}$/);
    if (envMatch) {
      const envVar = envMatch[1];
      if (typeof envVar === "string") {
        return this.envVars[envVar] ?? null; // Coerce undefined to null
      }
      return null;
    }

    // 3. Variable reference resolution (simple or complex)
    // We already know it's not a simple literal at this point because
    // _isSimpleLiteral is more permissive for numeric/boolean literals.
    if (this._isVariableReference(operandStr)) {
      return this._resolveReference(operandStr);
    }

    // 4. Numeric, boolean, null literals (handled by _parseSimpleValue)
    // This catches numbers like "123", booleans "true", "false", and "null".
    // Important: _parseSimpleValue here won't re-parse JSON objects/arrays as they
    // won't appear as simple "tokens" in an arithmetic expression context like this.
    return this._parseSimpleValue(operandStr);
  }

  /**
   * Check if a given token is an arithmetic operator.
   */
  private _isOperator(token: string): boolean {
    return ["+", "-", "*", "/", "%"].includes(token);
  }

  /**
   * Convert a value to a number (integer or float).
   * @param value The value to convert.
   * @returns The converted numeric value.
   * @throws {UCLTypeError} If the value cannot be converted to a number.
   */
  private _toNumber(value: UCLValue): number {
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
      return 0; // Treat null as 0 in arithmetic contexts
    }
    throw new UCLTypeError(`Cannot convert '${value}' to number`);
  }

  /**
   * Check if a string likely represents a variable reference.
   * A reference typically contains dots for nested access, or is a plain
   * word that isn't a simple literal.
   */
  private _isVariableReference(valueStr: string): boolean {
    // If it's a quoted string, or a numeric/boolean/null literal, it's not a reference.
    if (this._isSimpleLiteral(valueStr)) {
      return false;
    }

    // Check for a valid identifier or dot-separated path, possibly with array/object accessors.
    // This regex ensures it starts with an alphabet/underscore and contains only alphanumeric/underscore/dot/brackets
    // and correctly formed array/object accessors.
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(\[\s*(?:'[^']*'|"[^"]*"|(?:\d+))\s*\])*$/.test(
      valueStr,
    );
  }

  /**
   * Resolve a variable reference (e.g., "section.key", "myArray[0]", "myDict.key").
   * This method attempts to find the value corresponding to the given reference
   * path within the current configuration.
   * @param ref The reference string.
   * @returns The resolved value.
   * @throws {UCLReferenceError} If the reference cannot be resolved.
   */
  private _resolveReference(ref: string): UCLValue {
    // If it contains brackets, handle as a complex reference
    if (ref.includes("[") || ref.includes("]")) {
      return this._resolveComplexReference(ref);
    }

    // Simple dot-separated reference
    const parts = ref.split(".");
    let current: UCLValue = this.config; // Start from the root config

    for (const part of parts) {
      // Ensure 'current' is an object and contains 'part'
      if (
        typeof current === "object" &&
        current !== null &&
        !Array.isArray(current) &&
        (current as UCLObject).hasOwnProperty(part)
      ) {
        const resolvedValue: any = (current as UCLObject)[part];
        if (resolvedValue === undefined) {
          throw new UCLReferenceError(`Cannot resolve reference: ${ref}`);
        }
        current = resolvedValue;
      } else {
        // If not found as absolute path, try resolving relative to the current section
        if (this.currentSection.length > 0) {
          // Construct potential full path from current section and reference parts
          const potentialRelativePathParts = [...this.currentSection];
          let tempCurrent: UCLValue = this.config;
          try {
            // Navigate through the current section path
            for(const sectionPart of potentialRelativePathParts) {
                if (typeof tempCurrent === "object" && tempCurrent !== null && !Array.isArray(tempCurrent) && (tempCurrent as UCLObject).hasOwnProperty(sectionPart)) {
                    const nextValue: any = (tempCurrent as UCLObject)[sectionPart];
                    if (nextValue === undefined) {
                        throw new Error("Invalid section path for relative lookup");
                    }
                    tempCurrent = nextValue;
                } else {
                    throw new Error("Invalid section path for relative lookup"); // Break from this inner try
                }
            }
            // Now resolve the reference parts relative to tempCurrent
            for(const refPart of parts) {
                 if (typeof tempCurrent === "object" && tempCurrent !== null && !Array.isArray(tempCurrent) && (tempCurrent as UCLObject).hasOwnProperty(refPart)) {
                    const nextValue = (tempCurrent as UCLObject)[refPart];
                    if (nextValue === undefined) {
                        throw new Error("Relative reference part not found"); // Break from this inner try
                    }
                    tempCurrent = nextValue;
                } else {
                    throw new Error("Relative reference part not found"); // Break from this inner try
                }
            }
            return tempCurrent; // Successfully resolved relative path
          } catch (e) {
            // Relative resolution failed, continue to throw original absolute reference error
          }
        }
        throw new UCLReferenceError(`Cannot resolve reference: ${ref}`);
      }
    }
    return current;
  }

  /**
   * Resolves complex references involving array indexing and object key access.
   * Examples: "myArray[0]", "myDict['key']", "nested.array[1].prop"
   * @param ref The complex reference string.
   * @returns The resolved value.
   * @throws {UCLReferenceError} If any part of the reference cannot be resolved or is invalid.
   * @throws {UCLSyntaxError} If brackets are mismatched.
   */
  private _resolveComplexReference(ref: string): UCLValue {
    // This regex splits the reference string into parts:
    // It captures either:
    // 1. A sequence of characters that are NOT '[' or '.' (for base parts like 'users')
    // 2. Or a sequence of characters starting with '.' followed by non-'[' characters (for nested object properties like '.name')
    // 3. Or a bracketed expression `[...]` (for array/object accessors)
    const refParts = ref.match(/([^[.]+)|(\.[^[.]+)|(\[[^\]]+\])/g);

    if (!refParts || refParts.length === 0) {
      throw new UCLSyntaxError(`Invalid complex reference format: ${ref}`);
    }

    let current: UCLValue = null;
    let baseRefHandled = false;

    for (const part of refParts) {
      if (!part) {
        // Skip any empty matches that might occur
        continue;
      }

      // Handle base reference or dot-separated properties
      if (!part.startsWith("[")) {
        if (!baseRefHandled) {
          // The base part (e.g., "Data" in "Data.users[0]") should be resolved by the primary _resolveReference
          // to handle both absolute and relative paths correctly.
          current = this._resolveReference(part.replace(/^\./, ""));
          baseRefHandled = true;
        } else if (
          typeof current === "object" &&
          current !== null &&
          !Array.isArray(current)
        ) {
          const key = part.replace(/^\./, ""); // Remove leading dot for nested properties
          if ((current as UCLObject).hasOwnProperty(key)) {
            const resolvedValue: any = (current as UCLObject)[key];
            if (resolvedValue === undefined) {
              throw new UCLReferenceError(
                `Object key '${key}' resolved to undefined in reference part '${part}' of '${ref}'`,
              );
            }
            current = resolvedValue;
          } else {
            throw new UCLReferenceError(
              `Object key not found: '${key}' in reference part '${part}' of '${ref}'`,
            );
          }
        } else {
          throw new UCLReferenceError(
            `Attempted to access key on a non-object value: '${part}' in '${ref}' (current value: ${JSON.stringify(current)})`,
          );
        }
      } else {
        // Handle array or object accessor like `[0]` or `['key']`
        const accessor = part.substring(1, part.length - 1).trim(); // Remove brackets

        if (typeof current !== "object" || current === null) {
          throw new UCLReferenceError(
            `Attempted to access property on non-object/non-array value: '${part}' in '${ref}' (current value: ${JSON.stringify(current)})`,
          );
        }

        // Try to parse as integer for array index
        const numIndex = Number(accessor);
        // Check if it's a valid integer index (e.g., "0", not "'0'" or "abc")
        if (!isNaN(numIndex) && String(numIndex) === accessor) {
          if (Array.isArray(current)) {
            if (numIndex >= 0 && numIndex < current.length) {
              const resolvedValue: any = current[numIndex];
              if (resolvedValue === undefined) {
                throw new UCLReferenceError(
                  `Array index ${numIndex} resolved to undefined in '${ref}'`,
                );
              }
              current = resolvedValue;
            } else {
              throw new UCLReferenceError(
                `Array index out of bounds: ${numIndex} in '${ref}'`,
              );
            }
          } else {
            throw new UCLReferenceError(
              `Attempted to index a non-array value with index ${numIndex} in '${ref}' (current value: ${JSON.stringify(current)})`,
            );
          }
        } else {
          // Otherwise, treat as an object key (strip quotes if present)
          const key = accessor.replace(/^['"]|['"]$/g, "");
          if (typeof current === "object" && !Array.isArray(current)) {
            if ((current as UCLObject).hasOwnProperty(key)) {
              const resolvedValue: any = (current as UCLObject)[key];
              if (resolvedValue === undefined) {
                throw new UCLReferenceError(
                  `Object key '${key}' resolved to undefined in '${ref}' (current value: ${JSON.stringify(current)})`,
                );
              }
              current = resolvedValue;
            } else {
              throw new UCLReferenceError(
                `Object key not found: '${key}' in '${ref}' (current value: ${JSON.stringify(current)})`,
              );
            }
          } else {
            throw new UCLReferenceError(
              `Attempted to access key on a non-object value with key '${key}' in '${ref}' (current value: ${JSON.stringify(current)})`,
            );
          }
        }
      }
    }
    return current;
  }

  /**
   * Convert a given value to a specified target type.
   * @param value The value to convert.
   * @param targetType The target type ('int', 'float', 'string', 'bool').
   * @returns The converted value.
   * @throws {UCLTypeError} If the conversion is not possible or the target type is unknown.
   */
  private _convertType(value: UCLValue, targetType: string): UCLValue {
    if (targetType === "int") {
      if (typeof value === "number") return Math.floor(value);
      if (typeof value === "string") {
        const num = Number(value);
        if (!isNaN(num) && isFinite(num)) {
          return Math.floor(num);
        }
      }
      if (value === null) return 0; // null to int as 0
      throw new UCLTypeError(`Cannot convert '${value}' to int`);
    } else if (targetType === "float") {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const num = Number(value);
        if (!isNaN(num) && isFinite(num)) {
          return num;
        }
      }
      if (value === null) return 0.0; // null to float as 0.0
      throw new UCLTypeError(`Cannot convert '${value}' to float`);
    } else if (targetType === "string") {
      if (typeof value === "boolean") return String(value).toLowerCase();
      if (value === null) return "null"; // null to string "null"
      return String(value);
    } else if (targetType === "bool") {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") {
        const lowerVal = value.toLowerCase();
        if (["true", "yes", "1"].includes(lowerVal)) {
          return true;
        }
        if (["false", "no", "0"].includes(lowerVal)) {
          return false;
        }
        throw new UCLTypeError(`Cannot convert string '${value}' to bool`);
      }
      if (value === null) return false; // null to bool as false
      throw new UCLTypeError(`Cannot convert '${value}' to bool`);
    } else {
      throw new UCLTypeError(`Unknown target type: ${targetType}`);
    }
  }

  /**
   * Set a value within the configuration dictionary, respecting the current section.
   * If `this.currentSection` is `['a', 'b']` and `key` is `c`, this will set `config['a']['b']['c'] = value`.
   * It creates intermediate objects as needed.
   * @param key The key for the value being set.
   * @param value The value to set.
   */
  private _setNestedValue(key: string, value: UCLValue): void {
    const fullPath = [...this.currentSection, key];
    let current: UCLObject = this.config;

    for (let i = 0; i < fullPath.length - 1; i++) {
      const part = fullPath[i];
      // Type check: ensure part is a string before using it as a key
      if (typeof part !== "string") {
        throw new UCLSyntaxError(
          `Invalid path part '${part}' while setting nested value`,
        );
      }
      if (
        typeof current[part] !== "object" ||
        current[part] === null ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }
      current = current[part] as UCLObject;
    }

    const lastKey = fullPath[fullPath.length - 1];
    // Type check: ensure lastKey is a string
    if (typeof lastKey !== "string") {
      throw new UCLSyntaxError(
        `Invalid key '${lastKey}' while setting nested value`,
      );
    }
    current[lastKey] = value;
  }

  /**
   * Get a nested value from the configuration object using a dot-separated path.
   * @param path The dot-separated path to the value (e.g., "section.subsection.key").
   * @returns The value at the specified path.
   * @throws {UCLReferenceError} If any part of the path does not exist.
   */
  private _getNestedValue(path: string): UCLValue {
    const parts = path.split(".");
    let current: UCLObject | UCLValue = this.config;

    for (const part of parts) {
      // Ensure 'current' is a non-null object (and not an array) and `part` exists as a property
      if (
        typeof current === "object" &&
        current !== null &&
        !Array.isArray(current) &&
        (current as UCLObject).hasOwnProperty(part)
      ) {
        const resolvedValue: any = (current as UCLObject)[part];
        if (resolvedValue === undefined) {
          throw new UCLReferenceError(`Path not found: ${path}`);
        }
        current = resolvedValue;
      } else {
        throw new UCLReferenceError(`Path not found: ${path}`);
      }
    }
    return current;
  }

  /**
   * Apply default values defined in the 'defaults' section to the configuration.
   * Default values are applied only if the corresponding key is not explicitly
   * set in the main configuration or if its value is `null`.
   */
  private _applyDefaults(): void {
    for (const path in this.defaults) {
      if (this.defaults.hasOwnProperty(path)) {
        // Use hasOwnProperty to avoid inherited properties
        try {
          const currentValue = this._getNestedValue(path);
          // Apply default only if current value is null
          if (currentValue === null) {
            // Ensure the default value is not undefined before passing to _setNestedValueByPath
            const defaultValue = this.defaults[path];
            if (defaultValue !== undefined) {
              this._setNestedValueByPath(path, defaultValue);
            }
          }
        } catch (e: any) {
          // If the path doesn't exist at all, apply the default
          if (e instanceof UCLReferenceError) {
            // Ensure the default value is not undefined before passing to _setNestedValueByPath
            const defaultValue = this.defaults[path];
            if (defaultValue !== undefined) {
              this._setNestedValueByPath(path, defaultValue);
            }
          } else {
            throw e; // Re-throw other errors
          }
        }
      }
    }
  }

  /**
   * Set a nested value in the configuration object given a full dot-separated path.
   * This method is similar to `_setNestedValue` but takes a full path string
   * instead of relying on `currentSection`.
   * @param path The full dot-separated path to the key (e.g., "section.subsection.key").
   * @param value The value to set.
   */
  private _setNestedValueByPath(path: string, value: UCLValue): void {
    const parts = path.split(".");
    let current: UCLObject = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      // Type check: ensure part is a string
      if (typeof part !== "string") {
        throw new UCLSyntaxError(
          `Invalid path part '${part}' while setting nested value by path`,
        );
      }
      if (
        typeof current[part] !== "object" ||
        current[part] === null ||
        Array.isArray(current[part])
      ) {
        current[part] = {};
      }
      current = current[part] as UCLObject;
    }
    const lastPart = parts[parts.length - 1];
    // Type check: ensure lastPart is a string
    if (typeof lastPart !== "string") {
      throw new UCLSyntaxError(
        `Invalid key '${lastPart}' while setting nested value by path`,
      );
    }
    current[lastPart] = value;
  }
}

// 3. Convenience Functions
/**
 * Convenience function to parse a UCL file.
 * Creates a new UCLParser instance and calls its `parseFile` method.
 * @param filepath The path to the UCL file.
 * @returns The parsed configuration object.
 * @throws {Error} If the specified file does not exist.
 * @throws {UCLError} For any errors encountered during parsing.
 */
function parseUclFile(filepath: string): UCLObject {
  const parser = new UCLParser();
  return parser.parseFile(filepath);
}

/**
 * Convenience function to parse UCL content from a string.
 * Creates a new UCLParser instance and calls its `parseString` method.
 * @param content The UCL content as a string.
 * @returns The parsed configuration object.
 * @throws {UCLError} For any errors encountered during parsing.
 */
function parseUclString(content: string): UCLObject {
  const parser = new UCLParser();
  return parser.parseString(content);
}

export {
  UCLParser,
  parseUclFile,
  parseUclString,
  UCLError,
  UCLSyntaxError,
  UCLReferenceError,
  UCLTypeError,
};
export type { UCLObject, UCLArray, UCLValue };