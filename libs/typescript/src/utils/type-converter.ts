import type { UCLValue } from "../types.js";
import { UCLTypeError } from "../errors.js";

/**
 * Convert a value to a specified target type.
 */
export function convertType(value: UCLValue, targetType: string): UCLValue {
  if (targetType === "int") {
    if (typeof value === "number") return Math.floor(value);
    if (typeof value === "string") {
      const num = Number(value);
      if (!isNaN(num) && isFinite(num)) {
        return Math.floor(num);
      }
    }
    if (value === null) return 0;
    throw new UCLTypeError(`Cannot convert '${value}' to int`);
  } else if (targetType === "float") {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const num = Number(value);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }
    }
    if (value === null) return 0.0;
    throw new UCLTypeError(`Cannot convert '${value}' to float`);
  } else if (targetType === "string") {
    if (typeof value === "boolean") return String(value).toLowerCase();
    if (value === null) return "null";
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
    if (value === null) return false;
    throw new UCLTypeError(`Cannot convert '${value}' to bool`);
  } else {
    throw new UCLTypeError(`Unknown target type: ${targetType}`);
  }
}