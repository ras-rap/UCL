import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import type { UCLValue, UCLObject, UCLArray } from "./types.js";
import {
  UCLError,
  UCLSyntaxError,
  UCLReferenceError,
  UCLTypeError,
} from "./errors.js";
import { removeComments } from "./utils/string-parser.js";
import {
  tokenizeExpression,
  isOperator,
  toNumber,
  containsOperators,
} from "./utils/expression-evaluator.js";
import { convertType } from "./utils/type-converter.js";
import {
  isVariableReference,
  resolveSimpleReference,
  resolveComplexReference,
} from "./utils/reference-resolver.js";
import { isSimpleLiteral, parseSimpleValue } from "./utils/value-parser.js";

export class UCLParser {
  private config: UCLObject = {};
  private currentSection: string[] = [];
  private defaults: UCLObject = {};
  private envVars: { [key: string]: string | undefined } = { ...process.env };
  private basePath: string = process.cwd();

  constructor() {}

  public parseFile(filepath: string): UCLObject {
    const fullPath = resolve(filepath);
    this.basePath = dirname(fullPath);

    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    const content = readFileSync(fullPath, "utf-8");
    return this.parseString(content);
  }

  public parseString(content: string): UCLObject {
    this.config = {};
    this.currentSection = [];
    this.defaults = {};

    content = removeComments(content);
    let lines = content.split("\n");

    lines = this._processIncludes(lines);
    this._parseLines(lines);
    this._applyDefaults();

    return this.config;
  }

  private _processIncludes(lines: string[]): string[] {
    const processedLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("include ")) {
        const match = trimmedLine.match(/^include\s+["']([^"']+)["']$/);
        if (match) {
          const includePath = match[1];
          const fullPath = resolve(this.basePath, includePath as string);

          if (existsSync(fullPath)) {
            const includeContent = readFileSync(fullPath, "utf-8");
            const cleanedIncludeContent = removeComments(includeContent);
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

  private _parseLines(lines: string[]): void {
    let i = 0;
    while (i < lines.length) {
      const line = (lines[i] ?? "").trim();

      if (!line) {
        i++;
        continue;
      }

      if (line.startsWith("[") && line.endsWith("]")) {
        const sectionName = line.substring(1, line.length - 1).trim();

        if (sectionName.toLowerCase() === "defaults") {
          i = this._parseDefaultsSection(lines, i + 1);
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

  private _parseDefaultsSection(lines: string[], startIdx: number): number {
    let i = startIdx;

    while (i < lines.length) {
      const line = (lines[i] ?? "").trim();

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

  private _parseKeyValue(lines: string[], startIdx: number): number {
    const line = (lines[startIdx] ?? "").trim();

    if (!line.includes("=")) {
      if (
        line &&
        !line.startsWith("[") &&
        !line.endsWith("]") &&
        !["{", "}"].includes(line)
      ) {
        if (!/[\[\]\{\}\,\"\']/.test(line)) {
          throw new UCLSyntaxError(
            `Invalid syntax: line without equals sign: ${line}`,
          );
        }
      }
      return startIdx + 1;
    }

    const [key, valuePart] = this._splitKeyValue(line);

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

  private _splitKeyValue(line: string): [string, string] {
    let inString = false;
    let quoteChar: string | null = null;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        quoteChar = char;
      } else if (inString && char === quoteChar && line[i - 1] !== "\\") {
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
        const line = (lines[i] ?? "").trim();
        if (line) {
          valueStr += "\n" + line;
          braceCount +=
            (line.match(/{/g)?.length || 0) - (line.match(/}/g)?.length || 0);
        }
        i++;
      }
      return [valueStr, i - 1];
    } else if (valueStr.startsWith("[")) {
      let bracketCount =
        (valueStr.match(/\[/g)?.length || 0) -
        (valueStr.match(/\]/g)?.length || 0);

      while (i < lines.length && bracketCount > 0) {
        const line = (lines[i] ?? "").trim();
        if (line) {
          valueStr += "\n" + line;
          bracketCount +=
            (line.match(/\[/g)?.length || 0) -
            (line.match(/\]/g)?.length || 0);
        }
        i++;
      }
      return [valueStr, i - 1];
    }
    return [initialValue, startIdx];
  }

  private _parseValue(valueStr: string): UCLValue {
    valueStr = valueStr.trim();

    if (!valueStr) {
      return null;
    }

    // Environment variable resolution
    const envMatch = valueStr.match(/^\$ENV\{([^}]+)\}$/);
    if (envMatch) {
      const envVar = envMatch[1];
      if (typeof envVar === "string") {
        return this.envVars[envVar] ?? null;
      }
      return null;
    }

    // Type conversion
    if (valueStr.includes(".") && !isSimpleLiteral(valueStr)) {
      const parts = valueStr.split(".");
      if (parts.length > 1) {
        const typeSuffix = parts[parts.length - 1];
        const baseValueStr = parts.slice(0, parts.length - 1).join(".");

        if (
          typeof typeSuffix === "string" &&
          ["int", "float", "string", "bool"].includes(typeSuffix.toLowerCase())
        ) {
          const baseValue = this._parseValue(baseValueStr);
          return convertType(baseValue, typeSuffix.toLowerCase());
        }
      }
    }

    // Expression evaluation
    if (containsOperators(valueStr) && !isSimpleLiteral(valueStr)) {
      return this._evaluateExpression(valueStr);
    }

    // Variable reference resolution
    if (!isSimpleLiteral(valueStr) && isVariableReference(valueStr)) {
      return this._resolveReference(valueStr);
    }

    // Simple literal parsing
    return parseSimpleValue(valueStr, (v) => this._parseValue(v));
  }

  private _evaluateExpression(expr: string): UCLValue {
    while (expr.includes("(")) {
      const start = expr.lastIndexOf("(");
      if (start === -1) {
        break;
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

    return this._evaluateSimpleExpression(expr);
  }

  private _evaluateSimpleExpression(expr: string): UCLValue {
    const rawTokens = tokenizeExpression(expr);

    let evaluatedTokens: UCLValue[] = [];
    for (const rawToken of rawTokens) {
      if (isOperator(rawToken)) {
        evaluatedTokens.push(rawToken);
      } else {
        evaluatedTokens.push(this._resolveOperand(rawToken));
      }
    }

    // Handle *, /, %
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
        const left = toNumber(leftToken);
        const rightToken = evaluatedTokens[++i];
        if (rightToken === undefined) {
          throw new UCLSyntaxError(
            "Missing right operand for operator '" + token + "'",
          );
        }
        const right = toNumber(rightToken);

        let result: number;
        if (token === "*") {
          result = left * right;
        } else if (token === "/") {
          if (right === 0) {
            throw new UCLTypeError("Division by zero");
          }
          result = left / right;
        } else {
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
    evaluatedTokens = processedTokens;

    // Handle +, -
    processedTokens = [];
    for (let i = 0; i < evaluatedTokens.length; i++) {
      const token = evaluatedTokens[i];
      if (token === "+" || token === "-") {
        const left = processedTokens.pop();
        const right = evaluatedTokens[++i];

        let result: UCLValue;
        if (token === "+") {
          if (typeof left === "string" || typeof right === "string") {
            result = String(left) + String(right);
          } else {
            if (left === undefined || right === undefined) {
              throw new UCLTypeError("Operand is undefined in addition");
            }
            result = toNumber(left) + toNumber(right);
          }
        } else {
          if (left === undefined || right === undefined) {
            throw new UCLTypeError("Operand is undefined in subtraction");
          }
          result = toNumber(left) - toNumber(right);
        }
        processedTokens.push(result);
      } else {
        if (token !== undefined) {
          processedTokens.push(token);
        }
      }
    }
    evaluatedTokens = processedTokens;

    return evaluatedTokens[0] !== undefined ? evaluatedTokens[0] : null;
  }

  private _resolveOperand(operandStr: string): UCLValue {
    operandStr = operandStr.trim();

    if (!operandStr) {
      return null;
    }

    if (
      (operandStr.startsWith('"') && operandStr.endsWith('"')) ||
      (operandStr.startsWith("'") && operandStr.endsWith("'"))
    ) {
      return operandStr.substring(1, operandStr.length - 1);
    }

    const envMatch = operandStr.match(/^\$ENV\{([^}]+)\}$/);
    if (envMatch) {
      const envVar = envMatch[1];
      if (typeof envVar === "string") {
        return this.envVars[envVar] ?? null;
      }
      return null;
    }

    if (isVariableReference(operandStr)) {
      return this._resolveReference(operandStr);
    }

    return parseSimpleValue(operandStr, (v) => this._parseValue(v));
  }

  private _resolveReference(ref: string): UCLValue {
    if (ref.includes("[") || ref.includes("]")) {
      return resolveComplexReference(
        ref,
        this.config,
        this.currentSection,
        (r) => this._resolveReference(r),
      );
    }

    return resolveSimpleReference(ref, this.config, this.currentSection);
  }

  private _setNestedValue(key: string, value: UCLValue): void {
    const fullPath = [...this.currentSection, key];
    let current: UCLObject = this.config;

    for (let i = 0; i < fullPath.length - 1; i++) {
      const part = fullPath[i];
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
    if (typeof lastKey !== "string") {
      throw new UCLSyntaxError(
        `Invalid key '${lastKey}' while setting nested value`,
      );
    }
    current[lastKey] = value;
  }

  private _getNestedValue(path: string): UCLValue {
    const parts = path.split(".");
    let current: UCLObject | UCLValue = this.config;

    for (const part of parts) {
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

  private _applyDefaults(): void {
    for (const path in this.defaults) {
      if (this.defaults.hasOwnProperty(path)) {
        try {
          const currentValue = this._getNestedValue(path);
          if (currentValue === null) {
            const defaultValue = this.defaults[path];
            if (defaultValue !== undefined) {
              this._setNestedValueByPath(path, defaultValue);
            }
          }
        } catch (e: any) {
          if (e instanceof UCLReferenceError) {
            const defaultValue = this.defaults[path];
            if (defaultValue !== undefined) {
              this._setNestedValueByPath(path, defaultValue);
            }
          } else {
            throw e;
          }
        }
      }
    }
  }

  private _setNestedValueByPath(path: string, value: UCLValue): void {
    const parts = path.split(".");
    let current: UCLObject = this.config;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
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
    if (typeof lastPart !== "string") {
      throw new UCLSyntaxError(
        `Invalid key '${lastPart}' while setting nested value by path`,
      );
    }
    current[lastPart] = value;
  }
}