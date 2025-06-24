import { UCLParser } from "./ucl-parser.js";
import type { UCLObject } from "./types.js";

/**
 * Convenience function to parse a UCL file.
 */
export function parseUclFile(filepath: string): UCLObject {
  const parser = new UCLParser();
  return parser.parseFile(filepath);
}

/**
 * Convenience function to parse UCL content from a string.
 */
export function parseUclString(content: string): UCLObject {
  const parser = new UCLParser();
  return parser.parseString(content);
}

// Re-export everything
export { UCLParser } from "./ucl-parser.js";
export {
  UCLError,
  UCLSyntaxError,
  UCLReferenceError,
  UCLTypeError,
} from "./errors.js";
export type { UCLObject, UCLArray, UCLValue } from "./types.js";