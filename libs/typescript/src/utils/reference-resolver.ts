import type { UCLValue, UCLObject } from "../types.js";
import { UCLReferenceError, UCLSyntaxError } from "../errors.js";

/**
 * Check if a string represents a variable reference.
 */
export function isVariableReference(valueStr: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(\[\s*(?:'[^']*'|"[^"]*"|(?:\d+))\s*\])*$/.test(
    valueStr,
  );
}

/**
 * Resolve a simple dot-separated reference.
 */
export function resolveSimpleReference(
  ref: string,
  config: UCLObject,
  currentSection: string[],
): UCLValue {
  const parts = ref.split(".");
  let current: UCLValue = config;

  for (const part of parts) {
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
      // Try relative resolution
      if (currentSection.length > 0) {
        const potentialRelativePathParts = [...currentSection];
        let tempCurrent: UCLValue = config;
        try {
          for (const sectionPart of potentialRelativePathParts) {
            if (
              typeof tempCurrent === "object" &&
              tempCurrent !== null &&
              !Array.isArray(tempCurrent) &&
              (tempCurrent as UCLObject).hasOwnProperty(sectionPart)
            ) {
              const nextValue: any = (tempCurrent as UCLObject)[sectionPart];
              if (nextValue === undefined) {
                throw new Error("Invalid section path for relative lookup");
              }
              tempCurrent = nextValue;
            } else {
              throw new Error("Invalid section path for relative lookup");
            }
          }
          for (const refPart of parts) {
            if (
              typeof tempCurrent === "object" &&
              tempCurrent !== null &&
              !Array.isArray(tempCurrent) &&
              (tempCurrent as UCLObject).hasOwnProperty(refPart)
            ) {
              const nextValue = (tempCurrent as UCLObject)[refPart];
              if (nextValue === undefined) {
                throw new Error("Relative reference part not found");
              }
              tempCurrent = nextValue;
            } else {
              throw new Error("Relative reference part not found");
            }
          }
          return tempCurrent;
        } catch (e) {
          // Continue to throw original error
        }
      }
      throw new UCLReferenceError(`Cannot resolve reference: ${ref}`);
    }
  }
  return current;
}

/**
 * Resolve complex references with array/object accessors.
 */
export function resolveComplexReference(
  ref: string,
  config: UCLObject,
  currentSection: string[],
  resolveReference: (ref: string) => UCLValue,
): UCLValue {
  const refParts = ref.match(/([^[.]+)|(\.[^[.]+)|(\[[^\]]+\])/g);

  if (!refParts || refParts.length === 0) {
    throw new UCLSyntaxError(`Invalid complex reference format: ${ref}`);
  }

  let current: UCLValue = null;
  let baseRefHandled = false;

  for (const part of refParts) {
    if (!part) {
      continue;
    }

    if (!part.startsWith("[")) {
      if (!baseRefHandled) {
        current = resolveReference(part.replace(/^\./, ""));
        baseRefHandled = true;
      } else if (
        typeof current === "object" &&
        current !== null &&
        !Array.isArray(current)
      ) {
        const key = part.replace(/^\./, "");
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
      const accessor = part.substring(1, part.length - 1).trim();

      if (typeof current !== "object" || current === null) {
        throw new UCLReferenceError(
          `Attempted to access property on non-object/non-array value: '${part}' in '${ref}' (current value: ${JSON.stringify(current)})`,
        );
      }

      const numIndex = Number(accessor);
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