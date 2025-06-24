// src/ucl-parser.ts
var {readFileSync, existsSync} = (() => ({}));

// node:path
function assertPath(path) {
  if (typeof path !== "string")
    throw new TypeError("Path must be a string. Received " + JSON.stringify(path));
}
function normalizeStringPosix(path, allowAboveRoot) {
  var res = "", lastSegmentLength = 0, lastSlash = -1, dots = 0, code;
  for (var i = 0;i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47)
      break;
    else
      code = 47;
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1)
        ;
      else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1)
                res = "", lastSegmentLength = 0;
              else
                res = res.slice(0, lastSlashIndex), lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              lastSlash = i, dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "", lastSegmentLength = 0, lastSlash = i, dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += "/..";
          else
            res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += "/" + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i, dots = 0;
    } else if (code === 46 && dots !== -1)
      ++dots;
    else
      dots = -1;
  }
  return res;
}
function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root, base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir)
    return base;
  if (dir === pathObject.root)
    return dir + base;
  return dir + sep + base;
}
function resolve() {
  var resolvedPath = "", resolvedAbsolute = false, cwd;
  for (var i = arguments.length - 1;i >= -1 && !resolvedAbsolute; i--) {
    var path;
    if (i >= 0)
      path = arguments[i];
    else {
      if (cwd === undefined)
        cwd = process.cwd();
      path = cwd;
    }
    if (assertPath(path), path.length === 0)
      continue;
    resolvedPath = path + "/" + resolvedPath, resolvedAbsolute = path.charCodeAt(0) === 47;
  }
  if (resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute), resolvedAbsolute)
    if (resolvedPath.length > 0)
      return "/" + resolvedPath;
    else
      return "/";
  else if (resolvedPath.length > 0)
    return resolvedPath;
  else
    return ".";
}
function normalize(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var isAbsolute = path.charCodeAt(0) === 47, trailingSeparator = path.charCodeAt(path.length - 1) === 47;
  if (path = normalizeStringPosix(path, !isAbsolute), path.length === 0 && !isAbsolute)
    path = ".";
  if (path.length > 0 && trailingSeparator)
    path += "/";
  if (isAbsolute)
    return "/" + path;
  return path;
}
function isAbsolute(path) {
  return assertPath(path), path.length > 0 && path.charCodeAt(0) === 47;
}
function join() {
  if (arguments.length === 0)
    return ".";
  var joined;
  for (var i = 0;i < arguments.length; ++i) {
    var arg = arguments[i];
    if (assertPath(arg), arg.length > 0)
      if (joined === undefined)
        joined = arg;
      else
        joined += "/" + arg;
  }
  if (joined === undefined)
    return ".";
  return normalize(joined);
}
function relative(from, to) {
  if (assertPath(from), assertPath(to), from === to)
    return "";
  if (from = resolve(from), to = resolve(to), from === to)
    return "";
  var fromStart = 1;
  for (;fromStart < from.length; ++fromStart)
    if (from.charCodeAt(fromStart) !== 47)
      break;
  var fromEnd = from.length, fromLen = fromEnd - fromStart, toStart = 1;
  for (;toStart < to.length; ++toStart)
    if (to.charCodeAt(toStart) !== 47)
      break;
  var toEnd = to.length, toLen = toEnd - toStart, length = fromLen < toLen ? fromLen : toLen, lastCommonSep = -1, i = 0;
  for (;i <= length; ++i) {
    if (i === length) {
      if (toLen > length) {
        if (to.charCodeAt(toStart + i) === 47)
          return to.slice(toStart + i + 1);
        else if (i === 0)
          return to.slice(toStart + i);
      } else if (fromLen > length) {
        if (from.charCodeAt(fromStart + i) === 47)
          lastCommonSep = i;
        else if (i === 0)
          lastCommonSep = 0;
      }
      break;
    }
    var fromCode = from.charCodeAt(fromStart + i), toCode = to.charCodeAt(toStart + i);
    if (fromCode !== toCode)
      break;
    else if (fromCode === 47)
      lastCommonSep = i;
  }
  var out = "";
  for (i = fromStart + lastCommonSep + 1;i <= fromEnd; ++i)
    if (i === fromEnd || from.charCodeAt(i) === 47)
      if (out.length === 0)
        out += "..";
      else
        out += "/..";
  if (out.length > 0)
    return out + to.slice(toStart + lastCommonSep);
  else {
    if (toStart += lastCommonSep, to.charCodeAt(toStart) === 47)
      ++toStart;
    return to.slice(toStart);
  }
}
function _makeLong(path) {
  return path;
}
function dirname(path) {
  if (assertPath(path), path.length === 0)
    return ".";
  var code = path.charCodeAt(0), hasRoot = code === 47, end = -1, matchedSlash = true;
  for (var i = path.length - 1;i >= 1; --i)
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else
      matchedSlash = false;
  if (end === -1)
    return hasRoot ? "/" : ".";
  if (hasRoot && end === 1)
    return "//";
  return path.slice(0, end);
}
function basename(path, ext) {
  if (ext !== undefined && typeof ext !== "string")
    throw new TypeError('"ext" argument must be a string');
  assertPath(path);
  var start = 0, end = -1, matchedSlash = true, i;
  if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
    if (ext.length === path.length && ext === path)
      return "";
    var extIdx = ext.length - 1, firstNonSlashEnd = -1;
    for (i = path.length - 1;i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else {
        if (firstNonSlashEnd === -1)
          matchedSlash = false, firstNonSlashEnd = i + 1;
        if (extIdx >= 0)
          if (code === ext.charCodeAt(extIdx)) {
            if (--extIdx === -1)
              end = i;
          } else
            extIdx = -1, end = firstNonSlashEnd;
      }
    }
    if (start === end)
      end = firstNonSlashEnd;
    else if (end === -1)
      end = path.length;
    return path.slice(start, end);
  } else {
    for (i = path.length - 1;i >= 0; --i)
      if (path.charCodeAt(i) === 47) {
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1)
        matchedSlash = false, end = i + 1;
    if (end === -1)
      return "";
    return path.slice(start, end);
  }
}
function extname(path) {
  assertPath(path);
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, preDotState = 0;
  for (var i = path.length - 1;i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1)
    return "";
  return path.slice(startDot, end);
}
function format(pathObject) {
  if (pathObject === null || typeof pathObject !== "object")
    throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
  return _format("/", pathObject);
}
function parse(path) {
  assertPath(path);
  var ret = { root: "", dir: "", base: "", ext: "", name: "" };
  if (path.length === 0)
    return ret;
  var code = path.charCodeAt(0), isAbsolute2 = code === 47, start;
  if (isAbsolute2)
    ret.root = "/", start = 1;
  else
    start = 0;
  var startDot = -1, startPart = 0, end = -1, matchedSlash = true, i = path.length - 1, preDotState = 0;
  for (;i >= start; --i) {
    if (code = path.charCodeAt(i), code === 47) {
      if (!matchedSlash) {
        startPart = i + 1;
        break;
      }
      continue;
    }
    if (end === -1)
      matchedSlash = false, end = i + 1;
    if (code === 46) {
      if (startDot === -1)
        startDot = i;
      else if (preDotState !== 1)
        preDotState = 1;
    } else if (startDot !== -1)
      preDotState = -1;
  }
  if (startDot === -1 || end === -1 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    if (end !== -1)
      if (startPart === 0 && isAbsolute2)
        ret.base = ret.name = path.slice(1, end);
      else
        ret.base = ret.name = path.slice(startPart, end);
  } else {
    if (startPart === 0 && isAbsolute2)
      ret.name = path.slice(1, startDot), ret.base = path.slice(1, end);
    else
      ret.name = path.slice(startPart, startDot), ret.base = path.slice(startPart, end);
    ret.ext = path.slice(startDot, end);
  }
  if (startPart > 0)
    ret.dir = path.slice(0, startPart - 1);
  else if (isAbsolute2)
    ret.dir = "/";
  return ret;
}
var sep = "/";
var delimiter = ":";
var posix = ((p) => (p.posix = p, p))({ resolve, normalize, isAbsolute, join, relative, _makeLong, dirname, basename, extname, format, parse, sep, delimiter, win32: null, posix: null });

// src/errors.ts
class UCLError extends Error {
  constructor(message) {
    super(message);
    this.name = "UCLError";
  }
}

class UCLSyntaxError extends UCLError {
  constructor(message) {
    super(message);
    this.name = "UCLSyntaxError";
  }
}

class UCLReferenceError extends UCLError {
  constructor(message) {
    super(message);
    this.name = "UCLReferenceError";
  }
}

class UCLTypeError extends UCLError {
  constructor(message) {
    super(message);
    this.name = "UCLTypeError";
  }
}

// src/utils/string-parser.ts
function parseString(s) {
  const escapeSequences = {
    n: `
`,
    t: "\t",
    r: "\r",
    "\\": "\\",
    '"': '"',
    "'": "'"
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
function parseArray(arrayStr, parseValue) {
  const content = arrayStr.substring(1, arrayStr.length - 1).trim();
  if (!content) {
    return [];
  }
  const cleanedContent = content.replace(/\s*\n\s*/g, " ");
  const elements = [];
  let currentElement = "";
  let bracketCount = 0;
  let braceCount = 0;
  let inString = false;
  let quoteChar = null;
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
function removeComments(content) {
  content = content.replace(/\/\*.*?\*\//gs, "");
  const lines = content.split(`
`);
  const cleanedLines = [];
  for (let line of lines) {
    let inString = false;
    let quoteChar = null;
    let i = 0;
    while (i < line.length) {
      const char = line[i];
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        quoteChar = char;
      } else if (inString && char === quoteChar && line[i - 1] !== "\\") {
        inString = false;
        quoteChar = null;
      } else if (!inString && char === "/" && i + 1 < line.length && line[i + 1] === "/") {
        line = line.substring(0, i);
        break;
      }
      i++;
    }
    cleanedLines.push(line);
  }
  return cleanedLines.join(`
`);
}

// src/utils/expression-evaluator.ts
function tokenizeExpression(expr) {
  const tokens = [];
  let currentToken = "";
  let inString = false;
  let quoteChar = null;
  const operatorsAndParentheses = ["+", "-", "*", "/", "%", "(", ")"];
  for (let i = 0;i < expr.length; i++) {
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
    } else if (char !== undefined && operatorsAndParentheses.includes(char)) {
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
function isOperator(token) {
  return ["+", "-", "*", "/", "%"].includes(token);
}
function toNumber(value) {
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
function containsOperators(valueStr) {
  let inString = false;
  let quoteChar = null;
  for (let i = 0;i < valueStr.length; i++) {
    const char = valueStr[i];
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      quoteChar = char;
    } else if (inString && char === quoteChar && valueStr[i - 1] !== "\\") {
      inString = false;
      quoteChar = null;
    } else if (!inString && char !== undefined && ["+", "-", "*", "/", "%"].includes(char)) {
      return true;
    }
  }
  return false;
}

// src/utils/type-converter.ts
function convertType(value, targetType) {
  if (targetType === "int") {
    if (typeof value === "number")
      return Math.floor(value);
    if (typeof value === "string") {
      const num = Number(value);
      if (!isNaN(num) && isFinite(num)) {
        return Math.floor(num);
      }
    }
    if (value === null)
      return 0;
    throw new UCLTypeError(`Cannot convert '${value}' to int`);
  } else if (targetType === "float") {
    if (typeof value === "number")
      return value;
    if (typeof value === "string") {
      const num = Number(value);
      if (!isNaN(num) && isFinite(num)) {
        return num;
      }
    }
    if (value === null)
      return 0;
    throw new UCLTypeError(`Cannot convert '${value}' to float`);
  } else if (targetType === "string") {
    if (typeof value === "boolean")
      return String(value).toLowerCase();
    if (value === null)
      return "null";
    return String(value);
  } else if (targetType === "bool") {
    if (typeof value === "boolean")
      return value;
    if (typeof value === "number")
      return value !== 0;
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
    if (value === null)
      return false;
    throw new UCLTypeError(`Cannot convert '${value}' to bool`);
  } else {
    throw new UCLTypeError(`Unknown target type: ${targetType}`);
  }
}

// src/utils/reference-resolver.ts
function isVariableReference(valueStr) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(\[\s*(?:'[^']*'|"[^"]*"|(?:\d+))\s*\])*$/.test(valueStr);
}
function resolveSimpleReference(ref, config, currentSection) {
  const parts = ref.split(".");
  let current = config;
  for (const part of parts) {
    if (typeof current === "object" && current !== null && !Array.isArray(current) && current.hasOwnProperty(part)) {
      const resolvedValue = current[part];
      if (resolvedValue === undefined) {
        throw new UCLReferenceError(`Cannot resolve reference: ${ref}`);
      }
      current = resolvedValue;
    } else {
      if (currentSection.length > 0) {
        const potentialRelativePathParts = [...currentSection];
        let tempCurrent = config;
        try {
          for (const sectionPart of potentialRelativePathParts) {
            if (typeof tempCurrent === "object" && tempCurrent !== null && !Array.isArray(tempCurrent) && tempCurrent.hasOwnProperty(sectionPart)) {
              const nextValue = tempCurrent[sectionPart];
              if (nextValue === undefined) {
                throw new Error("Invalid section path for relative lookup");
              }
              tempCurrent = nextValue;
            } else {
              throw new Error("Invalid section path for relative lookup");
            }
          }
          for (const refPart of parts) {
            if (typeof tempCurrent === "object" && tempCurrent !== null && !Array.isArray(tempCurrent) && tempCurrent.hasOwnProperty(refPart)) {
              const nextValue = tempCurrent[refPart];
              if (nextValue === undefined) {
                throw new Error("Relative reference part not found");
              }
              tempCurrent = nextValue;
            } else {
              throw new Error("Relative reference part not found");
            }
          }
          return tempCurrent;
        } catch (e) {}
      }
      throw new UCLReferenceError(`Cannot resolve reference: ${ref}`);
    }
  }
  return current;
}
function resolveComplexReference(ref, config, currentSection, resolveReference) {
  const refParts = ref.match(/([^[.]+)|(\.[^[.]+)|(\[[^\]]+\])/g);
  if (!refParts || refParts.length === 0) {
    throw new UCLSyntaxError(`Invalid complex reference format: ${ref}`);
  }
  let current = null;
  let baseRefHandled = false;
  for (const part of refParts) {
    if (!part) {
      continue;
    }
    if (!part.startsWith("[")) {
      if (!baseRefHandled) {
        current = resolveReference(part.replace(/^\./, ""));
        baseRefHandled = true;
      } else if (typeof current === "object" && current !== null && !Array.isArray(current)) {
        const key = part.replace(/^\./, "");
        if (current.hasOwnProperty(key)) {
          const resolvedValue = current[key];
          if (resolvedValue === undefined) {
            throw new UCLReferenceError(`Object key '${key}' resolved to undefined in reference part '${part}' of '${ref}'`);
          }
          current = resolvedValue;
        } else {
          throw new UCLReferenceError(`Object key not found: '${key}' in reference part '${part}' of '${ref}'`);
        }
      } else {
        throw new UCLReferenceError(`Attempted to access key on a non-object value: '${part}' in '${ref}' (current value: ${JSON.stringify(current)})`);
      }
    } else {
      const accessor = part.substring(1, part.length - 1).trim();
      if (typeof current !== "object" || current === null) {
        throw new UCLReferenceError(`Attempted to access property on non-object/non-array value: '${part}' in '${ref}' (current value: ${JSON.stringify(current)})`);
      }
      const numIndex = Number(accessor);
      if (!isNaN(numIndex) && String(numIndex) === accessor) {
        if (Array.isArray(current)) {
          if (numIndex >= 0 && numIndex < current.length) {
            const resolvedValue = current[numIndex];
            if (resolvedValue === undefined) {
              throw new UCLReferenceError(`Array index ${numIndex} resolved to undefined in '${ref}'`);
            }
            current = resolvedValue;
          } else {
            throw new UCLReferenceError(`Array index out of bounds: ${numIndex} in '${ref}'`);
          }
        } else {
          throw new UCLReferenceError(`Attempted to index a non-array value with index ${numIndex} in '${ref}' (current value: ${JSON.stringify(current)})`);
        }
      } else {
        const key = accessor.replace(/^['"]|['"]$/g, "");
        if (typeof current === "object" && !Array.isArray(current)) {
          if (current.hasOwnProperty(key)) {
            const resolvedValue = current[key];
            if (resolvedValue === undefined) {
              throw new UCLReferenceError(`Object key '${key}' resolved to undefined in '${ref}' (current value: ${JSON.stringify(current)})`);
            }
            current = resolvedValue;
          } else {
            throw new UCLReferenceError(`Object key not found: '${key}' in '${ref}' (current value: ${JSON.stringify(current)})`);
          }
        } else {
          throw new UCLReferenceError(`Attempted to access key on a non-object value with key '${key}' in '${ref}' (current value: ${JSON.stringify(current)})`);
        }
      }
    }
  }
  return current;
}

// src/utils/value-parser.ts
function isSimpleLiteral(valueStr) {
  valueStr = valueStr.trim();
  if (valueStr.startsWith('"') && valueStr.endsWith('"') || valueStr.startsWith("'") && valueStr.endsWith("'")) {
    return !_containsOperators(valueStr);
  }
  if (valueStr.startsWith("[") && valueStr.endsWith("]") || valueStr.startsWith("{") && valueStr.endsWith("}")) {
    try {
      JSON.parse(valueStr);
      return true;
    } catch (e) {
      return false;
    }
  }
  if (["true", "false", "null"].includes(valueStr.toLowerCase())) {
    return true;
  }
  if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
    return !isNaN(parseFloat(valueStr)) && isFinite(Number(valueStr));
  }
  return false;
}
function _containsOperators(valueStr) {
  const operators = ["+", "-", "*", "/", "%", "=", ">", "<", "&", "|", "^", "~", "!", "?", ":"];
  const quoteChar = valueStr[0];
  const inner = valueStr.substring(1, valueStr.length - 1);
  return operators.some((op) => inner.includes(op));
}
function parseSimpleValue(valueStr, parseValueCallback) {
  valueStr = valueStr.trim();
  if (valueStr.toLowerCase() === "null") {
    return null;
  }
  if (["true", "false"].includes(valueStr.toLowerCase())) {
    return valueStr.toLowerCase() === "true";
  }
  if (valueStr.startsWith('"') && valueStr.endsWith('"') || valueStr.startsWith("'") && valueStr.endsWith("'")) {
    return parseString(valueStr.substring(1, valueStr.length - 1));
  }
  if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
    return parseArray(valueStr, parseValueCallback);
  }
  if (valueStr.startsWith("{") && valueStr.endsWith("}")) {
    try {
      return JSON.parse(valueStr);
    } catch (e) {
      throw new UCLSyntaxError(`Invalid JSON object: ${e.message} in '${valueStr}'`);
    }
  }
  const num = Number(valueStr);
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }
  return valueStr;
}

// src/ucl-parser.ts
class UCLParser {
  config = {};
  currentSection = [];
  defaults = {};
  envVars = { ...process.env };
  basePath = process.cwd();
  constructor() {}
  parseFile(filepath) {
    const fullPath = resolve(filepath);
    this.basePath = dirname(fullPath);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filepath}`);
    }
    const content = readFileSync(fullPath, "utf-8");
    return this.parseString(content);
  }
  parseString(content) {
    this.config = {};
    this.currentSection = [];
    this.defaults = {};
    content = removeComments(content);
    let lines = content.split(`
`);
    lines = this._processIncludes(lines);
    this._parseLines(lines);
    this._applyDefaults();
    return this.config;
  }
  _processIncludes(lines) {
    const processedLines = [];
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith("include ")) {
        const match = trimmedLine.match(/^include\s+["']([^"']+)["']$/);
        if (match) {
          const includePath = match[1];
          const fullPath = resolve(this.basePath, includePath);
          if (existsSync(fullPath)) {
            const includeContent = readFileSync(fullPath, "utf-8");
            const cleanedIncludeContent = removeComments(includeContent);
            const includeLines = cleanedIncludeContent.split(`
`);
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
  _parseLines(lines) {
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
  _parseDefaultsSection(lines, startIdx) {
    let i = startIdx;
    while (i < lines.length) {
      const line = (lines[i] ?? "").trim();
      if (!line) {
        i++;
        continue;
      }
      if (line.startsWith("[") && line.endsWith("]")) {
        throw new UCLSyntaxError("Defaults section must be at the end of the file");
      }
      if (line.includes("=")) {
        const [key, valuePart] = this._splitKeyValue(line);
        this.defaults[key] = this._parseValue(valuePart);
      }
      i++;
    }
    return i;
  }
  _parseKeyValue(lines, startIdx) {
    const line = (lines[startIdx] ?? "").trim();
    if (!line.includes("=")) {
      if (line && !line.startsWith("[") && !line.endsWith("]") && !["{", "}"].includes(line)) {
        if (!/[\[\]\{\}\,\"\']/.test(line)) {
          throw new UCLSyntaxError(`Invalid syntax: line without equals sign: ${line}`);
        }
      }
      return startIdx + 1;
    }
    const [key, valuePart] = this._splitKeyValue(line);
    if (valuePart.trim().startsWith("{") || valuePart.trim().startsWith("[")) {
      const [valueStr, endIdx] = this._parseMultilineValue(lines, startIdx, valuePart);
      const value = this._parseValue(valueStr);
      this._setNestedValue(key, value);
      return endIdx + 1;
    } else {
      const value = this._parseValue(valuePart);
      this._setNestedValue(key, value);
      return startIdx + 1;
    }
  }
  _splitKeyValue(line) {
    let inString = false;
    let quoteChar = null;
    for (let i = 0;i < line.length; i++) {
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
  _parseMultilineValue(lines, startIdx, initialValue) {
    let valueStr = initialValue.trim();
    let i = startIdx + 1;
    if (valueStr.startsWith("{")) {
      let braceCount = (valueStr.match(/{/g)?.length || 0) - (valueStr.match(/}/g)?.length || 0);
      while (i < lines.length && braceCount > 0) {
        const line = (lines[i] ?? "").trim();
        if (line) {
          valueStr += `
` + line;
          braceCount += (line.match(/{/g)?.length || 0) - (line.match(/}/g)?.length || 0);
        }
        i++;
      }
      return [valueStr, i - 1];
    } else if (valueStr.startsWith("[")) {
      let bracketCount = (valueStr.match(/\[/g)?.length || 0) - (valueStr.match(/\]/g)?.length || 0);
      while (i < lines.length && bracketCount > 0) {
        const line = (lines[i] ?? "").trim();
        if (line) {
          valueStr += `
` + line;
          bracketCount += (line.match(/\[/g)?.length || 0) - (line.match(/\]/g)?.length || 0);
        }
        i++;
      }
      return [valueStr, i - 1];
    }
    return [initialValue, startIdx];
  }
  _parseValue(valueStr) {
    valueStr = valueStr.trim();
    if (!valueStr) {
      return null;
    }
    const envMatch = valueStr.match(/^\$ENV\{([^}]+)\}$/);
    if (envMatch) {
      const envVar = envMatch[1];
      if (typeof envVar === "string") {
        return this.envVars[envVar] ?? null;
      }
      return null;
    }
    if (valueStr.includes(".") && !isSimpleLiteral(valueStr)) {
      const parts = valueStr.split(".");
      if (parts.length > 1) {
        const typeSuffix = parts[parts.length - 1];
        const baseValueStr = parts.slice(0, parts.length - 1).join(".");
        if (typeof typeSuffix === "string" && ["int", "float", "string", "bool"].includes(typeSuffix.toLowerCase())) {
          const baseValue = this._parseValue(baseValueStr);
          return convertType(baseValue, typeSuffix.toLowerCase());
        }
      }
    }
    if (containsOperators(valueStr) && !isSimpleLiteral(valueStr)) {
      return this._evaluateExpression(valueStr);
    }
    if (!isSimpleLiteral(valueStr) && isVariableReference(valueStr)) {
      return this._resolveReference(valueStr);
    }
    return parseSimpleValue(valueStr, (v) => this._parseValue(v));
  }
  _evaluateExpression(expr) {
    while (expr.includes("(")) {
      const start = expr.lastIndexOf("(");
      if (start === -1) {
        break;
      }
      let end = -1;
      let openCount = 0;
      for (let i = start;i < expr.length; i++) {
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
        throw new UCLSyntaxError(`Mismatched parentheses in expression: ${expr}`);
      }
      const innerExpr = expr.substring(start + 1, end);
      const result = this._evaluateSimpleExpression(innerExpr);
      expr = expr.substring(0, start) + String(result) + expr.substring(end + 1);
    }
    return this._evaluateSimpleExpression(expr);
  }
  _evaluateSimpleExpression(expr) {
    const rawTokens = tokenizeExpression(expr);
    let evaluatedTokens = [];
    for (const rawToken of rawTokens) {
      if (isOperator(rawToken)) {
        evaluatedTokens.push(rawToken);
      } else {
        evaluatedTokens.push(this._resolveOperand(rawToken));
      }
    }
    let processedTokens = [];
    for (let i = 0;i < evaluatedTokens.length; i++) {
      const token = evaluatedTokens[i];
      if (token === "*" || token === "/" || token === "%") {
        const leftToken = processedTokens.pop();
        if (leftToken === undefined) {
          throw new UCLSyntaxError("Missing left operand for operator '" + token + "'");
        }
        const left = toNumber(leftToken);
        const rightToken = evaluatedTokens[++i];
        if (rightToken === undefined) {
          throw new UCLSyntaxError("Missing right operand for operator '" + token + "'");
        }
        const right = toNumber(rightToken);
        let result;
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
    processedTokens = [];
    for (let i = 0;i < evaluatedTokens.length; i++) {
      const token = evaluatedTokens[i];
      if (token === "+" || token === "-") {
        const left = processedTokens.pop();
        const right = evaluatedTokens[++i];
        let result;
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
  _resolveOperand(operandStr) {
    operandStr = operandStr.trim();
    if (!operandStr) {
      return null;
    }
    if (operandStr.startsWith('"') && operandStr.endsWith('"') || operandStr.startsWith("'") && operandStr.endsWith("'")) {
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
  _resolveReference(ref) {
    if (ref.includes("[") || ref.includes("]")) {
      return resolveComplexReference(ref, this.config, this.currentSection, (r) => this._resolveReference(r));
    }
    return resolveSimpleReference(ref, this.config, this.currentSection);
  }
  _setNestedValue(key, value) {
    const fullPath = [...this.currentSection, key];
    let current = this.config;
    for (let i = 0;i < fullPath.length - 1; i++) {
      const part = fullPath[i];
      if (typeof part !== "string") {
        throw new UCLSyntaxError(`Invalid path part '${part}' while setting nested value`);
      }
      if (typeof current[part] !== "object" || current[part] === null || Array.isArray(current[part])) {
        current[part] = {};
      }
      current = current[part];
    }
    const lastKey = fullPath[fullPath.length - 1];
    if (typeof lastKey !== "string") {
      throw new UCLSyntaxError(`Invalid key '${lastKey}' while setting nested value`);
    }
    current[lastKey] = value;
  }
  _getNestedValue(path) {
    const parts = path.split(".");
    let current = this.config;
    for (const part of parts) {
      if (typeof current === "object" && current !== null && !Array.isArray(current) && current.hasOwnProperty(part)) {
        const resolvedValue = current[part];
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
  _applyDefaults() {
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
        } catch (e) {
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
  _setNestedValueByPath(path, value) {
    const parts = path.split(".");
    let current = this.config;
    for (let i = 0;i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof part !== "string") {
        throw new UCLSyntaxError(`Invalid path part '${part}' while setting nested value by path`);
      }
      if (typeof current[part] !== "object" || current[part] === null || Array.isArray(current[part])) {
        current[part] = {};
      }
      current = current[part];
    }
    const lastPart = parts[parts.length - 1];
    if (typeof lastPart !== "string") {
      throw new UCLSyntaxError(`Invalid key '${lastPart}' while setting nested value by path`);
    }
    current[lastPart] = value;
  }
}

// src/index.ts
function parseUclFile(filepath) {
  const parser = new UCLParser;
  return parser.parseFile(filepath);
}
function parseUclString(content) {
  const parser = new UCLParser;
  return parser.parseString(content);
}
export {
  parseUclString,
  parseUclFile,
  UCLTypeError,
  UCLSyntaxError,
  UCLReferenceError,
  UCLParser,
  UCLError
};
