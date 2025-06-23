import re
import json
import os
from typing import Any, Dict, List, Union, Optional
from pathlib import Path


class UCLError(Exception):
    """Base exception for UCL parsing errors."""
    pass


class UCLSyntaxError(UCLError):
    """Raised when there's a syntax error in the UCL file."""
    pass


class UCLReferenceError(UCLError):
    """Raised when a variable reference cannot be resolved."""
    pass


class UCLTypeError(UCLError):
    """Raised when type conversion fails."""
    pass


class UCLParser:
    """
    Universal Configuration Language (UCL) Parser.

    This parser handles the parsing of UCL files and strings, including features
    like comments, includes, sections, key-value pairs, nested structures
    (objects and arrays), type conversions, environment variable resolution,
    variable references, arithmetic expressions, and default values.
    """

    def __init__(self):
        """
        Initializes the UCLParser.

        Sets up the internal state for parsing, including the configuration dictionary,
        current parsing section, default values, environment variables, and base path.
        """
        self.config = {}
        self.current_section = []
        self.defaults = {}
        self.env_vars = os.environ.copy()
        self.base_path = Path.cwd()

    def parse_file(self, filepath: Union[str, Path]) -> Dict[str, Any]:
        """
        Parse a UCL file and return the configuration dictionary.

        Args:
            filepath (Union[str, Path]): The path to the UCL file.

        Returns:
            Dict[str, Any]: The parsed configuration as a dictionary.

        Raises:
            FileNotFoundError: If the specified file does not exist.
            UCLError: For any errors encountered during parsing.
        """
        filepath = Path(filepath)
        self.base_path = filepath.parent

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        return self.parse_string(content)

    def parse_string(self, content: str) -> Dict[str, Any]:
        """
        Parse UCL content from a string.

        Args:
            content (str): The UCL content as a string.

        Returns:
            Dict[str, Any]: The parsed configuration as a dictionary.

        Raises:
            UCLError: For any errors encountered during parsing.
        """
        self.config = {}
        self.current_section = []
        self.defaults = {}

        content = self._remove_comments(content)
        lines = content.split('\n')

        lines = self._process_includes(lines)

        self._parse_lines(lines)

        self._apply_defaults()

        return self.config

    def _remove_comments(self, content: str) -> str:
        """
        Remove single-line (//) and multi-line (/* ... */) comments from the content.

        Args:
            content (str): The raw UCL content string.

        Returns:
            str: The content string with comments removed.
        """
        # Remove multi-line comments first
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

        lines = content.split('\n')
        cleaned_lines = []

        for line in lines:
            in_string = False
            quote_char = None
            i = 0

            while i < len(line):
                char = line[i]

                if not in_string and char in ['"', "'"]:
                    in_string = True
                    quote_char = char
                elif in_string and char == quote_char and \
                        (i == 0 or line[i - 1] != '\\'):
                    in_string = False
                    quote_char = None
                elif not in_string and char == '/' and i + 1 < len(line) and \
                        line[i + 1] == '/':
                    line = line[:i]  # Remove rest of the line
                    break

                i += 1

            cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)

    def _process_includes(self, lines: List[str]) -> List[str]:
        """
        Process 'include' directives in the UCL content.

        This method replaces `include "path/to/file.ucl"` lines with the
        content of the included files. Includes are processed recursively.

        Args:
            lines (List[str]): A list of lines from the UCL content.

        Returns:
            List[str]: A new list of lines with included content integrated.

        Raises:
            UCLError: If an included file is not found.
            UCLSyntaxError: If the include syntax is invalid.
        """
        processed_lines = []

        for line in lines:
            line = line.strip()
            if line.startswith('include '):
                match = re.match(r'include\s+["\']([^"\']+)["\']', line)
                if match:
                    include_path = match.group(1)
                    full_path = self.base_path / include_path

                    if full_path.exists():
                        with open(full_path, 'r', encoding='utf-8') as f:
                            include_content = f.read()

                        # Recursively process includes in the included file
                        include_content = self._remove_comments(include_content)
                        include_lines = include_content.split('\n')
                        include_lines = self._process_includes(include_lines)
                        processed_lines.extend(include_lines)
                    else:
                        raise UCLError(f"Include file not found: {include_path}")
                else:
                    raise UCLSyntaxError(f"Invalid include syntax: {line}")
            else:
                processed_lines.append(line)

        return processed_lines

    def _parse_lines(self, lines: List[str]) -> None:
        """
        Parse the UCL lines, handling sections and key-value pairs.

        This is the main parsing loop that iterates through the cleaned lines
        of the UCL content.

        Args:
            lines (List[str]): A list of cleaned UCL content lines.
        """
        i = 0
        while i < len(lines):
            line = lines[i].strip()

            if not line:
                i += 1
                continue

            if line.startswith('[') and line.endswith(']'):
                section_name = line[1:-1].strip()

                if section_name.lower() == 'defaults':
                    # Defaults section must be parsed to the end
                    i = self._parse_defaults_section(lines, i + 1)
                    # Once defaults are parsed, there should be no more config
                    break
                else:
                    self.current_section = section_name.split('.')
                    i += 1
            else:
                i = self._parse_key_value(lines, i)

    def _parse_defaults_section(self, lines: List[str], start_idx: int) -> int:
        """
        Parse the 'defaults' section of the UCL file.

        The defaults section defines default values for configuration keys.
        It must appear at the end of the file.

        Args:
            lines (List[str]): All lines from the UCL content.
            start_idx (int): The starting index for parsing the defaults section.

        Returns:
            int: The index of the last line processed in the defaults section.

        Raises:
            UCLSyntaxError: If a new section is encountered within the defaults section.
        """
        i = start_idx

        while i < len(lines):
            line = lines[i].strip()

            if not line:
                i += 1
                continue

            if line.startswith('[') and line.endswith(']'):
                raise UCLSyntaxError("Defaults section must be at the end of the file")

            if '=' in line:
                key, value = self._split_key_value(line)
                self.defaults[key] = self._parse_value(value)

            i += 1

        return i

    def _parse_key_value(self, lines: List[str], start_idx: int) -> int:
        """
        Parse a key-value pair, handling potential multi-line values (JSON objects/arrays).

        Args:
            lines (List[str]): All lines from the UCL content.
            start_idx (int): The starting index for parsing the key-value pair.

        Returns:
            int: The index of the next line to process after parsing the current
                 key-value pair (or multi-line structure).

        Raises:
            UCLSyntaxError: If the line has invalid syntax for a key-value pair.
        """
        line = lines[start_idx].strip()

        if '=' not in line:
            # This case handles lines that are not key-value but might be part of
            # a multi-line structure or just empty/comments already removed.
            # If it's not an empty line, section, or json-like structure, it's an error.
            if line and not line.startswith('[') and not line.endswith(']') and \
               not line.strip() in ['{', '}']:
                # Check for characters that indicate it might be part of a JSON structure
                if not any(c in line for c in ['[', ']', '{', '}', ',', '"', "'"]):
                    raise UCLSyntaxError(f"Invalid syntax: line without equals sign: {line}")
            return start_idx + 1

        key, value_part = self._split_key_value(line)

        # Check if the value starts a multi-line JSON object or array
        if value_part.strip().startswith('{') or value_part.strip().startswith('['):
            value_str, end_idx = self._parse_multiline_value(lines, start_idx, value_part)
            value = self._parse_value(value_str)
            self._set_nested_value(key, value)
            return end_idx + 1
        else:
            value = self._parse_value(value_part)
            self._set_nested_value(key, value)
            return start_idx + 1

    def _split_key_value(self, line: str) -> tuple:
        """
        Split a line into key and value parts, respecting quoted strings.

        Ensures that an '=' sign within a quoted string does not split the key-value.

        Args:
            line (str): The line containing the key-value pair.

        Returns:
            tuple: A tuple (key, value) where both are strings.

        Raises:
            UCLSyntaxError: If no valid '=' separator is found.
        """
        in_string = False
        quote_char = None

        for i, char in enumerate(line):
            if not in_string and char in ['"', "'"]:
                in_string = True
                quote_char = char
            elif in_string and char == quote_char and \
                    (i == 0 or line[i - 1] != '\\'):
                # Handle escaped quotes
                in_string = False
                quote_char = None
            elif not in_string and char == '=':
                key = line[:i].strip()
                value = line[i + 1:].strip()
                return key, value

        raise UCLSyntaxError(f"Invalid key-value syntax: {line}")

    def _parse_multiline_value(self, lines: List[str], start_idx: int, initial_value: str) -> tuple:
        """
        Parse multi-line JSON objects and arrays by counting braces/brackets.

        Args:
            lines (List[str]): All lines from the UCL content.
            start_idx (int): The starting line index where the multi-line value begins.
            initial_value (str): The content of the first line of the multi-line value.

        Returns:
            tuple: A tuple containing (full_value_string, end_index) where
                   full_value_string is the complete multi-line value, and
                   end_index is the line number where the multi-line value ends.
        """
        value_str = initial_value.strip()

        if value_str.startswith('{'):
            brace_count = value_str.count('{') - value_str.count('}')
            i = start_idx + 1

            while i < len(lines) and brace_count > 0:
                line = lines[i].strip()
                if line:
                    value_str += '\n' + line
                    brace_count += line.count('{') - line.count('}')
                i += 1

            # Ensure we return the index of the last line of the value, not the next line
            return value_str, i - 1

        elif value_str.startswith('['):
            bracket_count = value_str.count('[') - value_str.count(']')
            i = start_idx + 1

            while i < len(lines) and bracket_count > 0:
                line = lines[i].strip()
                if line:
                    value_str += '\n' + line
                    bracket_count += line.count('[') - line.count(']')
                i += 1

            # Ensure we return the index of the last line of the value, not the next line
            return value_str, i - 1

        return initial_value, start_idx

    def _parse_value(self, value_str: str) -> Any:
        """
        Parse a value string into the appropriate Python type.

        This method is responsible for:
        - Resolving environment variables ($ENV{VAR_NAME})
        - Performing explicit type conversions (e.g., "123.int")
        - Evaluating arithmetic expressions and string concatenations
        - Resolving variable references (e.g., "my.other.setting")
        - Parsing simple literals (strings, numbers, booleans, null, arrays, objects)

        Args:
            value_str (str): The string representation of the value.

        Returns:
            Any: The parsed value in its native Python type.

        Raises:
            UCLReferenceError: If a variable reference cannot be resolved.
            UCLTypeError: If a type conversion fails.
            UCLSyntaxError: If JSON parsing fails for array/object literals.
        """
        value_str = value_str.strip()

        if not value_str:
            return None

        # 1. Environment variable resolution
        env_match = re.match(r'\$ENV\{([^}]+)\}', value_str)
        if env_match:
            env_var = env_match.group(1)
            return self.env_vars.get(env_var)

        # 2. Explicit type conversion (e.g., "123.int", "4.5.string")
        # Check for type conversion suffix, but not if it's a simple literal ending with .
        if '.' in value_str and not self._is_simple_literal(value_str):
            parts = value_str.rsplit('.', 1)
            if len(parts) == 2 and parts[1] in ['int', 'float', 'string', 'bool']:
                base_value = self._parse_value(parts[0])  # Recursively parse base
                try:
                    return self._convert_type(base_value, parts[1])
                except UCLTypeError:
                    raise

        # 3. Arithmetic expressions and string concatenation
        if self._contains_operators(value_str) and not self._is_simple_literal(
                value_str):
            return self._evaluate_expression(value_str)

        # 4. Variable reference resolution (must come after simple literal check)
        if not self._is_simple_literal(value_str) and self._is_variable_reference(
                value_str):
            return self._resolve_reference(value_str)

        # 5. Simple literal parsing (strings, numbers, booleans, null, arrays, objects)
        return self._parse_simple_value(value_str)

    def _contains_operators(self, value_str: str) -> bool:
        """
        Check if a string contains arithmetic operators (+, -, *, /, %) outside of quoted strings.

        This helps differentiate between a value that is a literal string containing
        an operator (e.g., "my+string") and an actual expression (e.g., "1+2").

        Args:
            value_str (str): The string to check.

        Returns:
            bool: True if operators are found outside of strings, False otherwise.
        """
        in_string = False
        quote_char = None

        for i, char in enumerate(value_str):
            if not in_string and char in ['"', "'"]:
                in_string = True
                quote_char = char
            elif in_string and char == quote_char and \
                    (i == 0 or value_str[i - 1] != '\\'):
                in_string = False
                quote_char = None
            elif not in_string and char in ['+', '-', '*', '/', '%']:
                return True

        return False

    def _is_simple_literal(self, value_str: str) -> bool:
        """
        Check if a value string represents a simple literal (string, number, boolean, null, array, object).

        This helps distinguish between literal values and potential expressions or references.

        Args:
            value_str (str): The string to check.

        Returns:
            bool: True if the string is a simple literal, False otherwise.
        """
        value_str = value_str.strip()

        # Quoted string literal
        if (value_str.startswith('"') and value_str.endswith('"') and 
        not self._contains_operators(value_str)):
            # Only consider it a simple string if it doesn't also look like an expression
            # inside (e.g. "'1+2'") - though _parse_string handles escapes for real strings.
            # This is primarily to distinguish "ref" from "literal" and not evaluate "ref"
            # as an expression.
            return True

        # JSON array or object literal
        if (value_str.startswith('[') and value_str.endswith(']')) or \
           (value_str.startswith('{') and value_str.endswith('}')):
            return True

        # Boolean or null literal (case-insensitive)
        if value_str.lower() in ['true', 'false', 'null']:
            return True

        # Numeric literal
        try:
            float(value_str)  # Try converting to float for both int and float
            return True
        except ValueError:
            pass

        return False

    def _parse_simple_value(self, value_str: str) -> Any:
        """
        Parse simple literal values (strings, numbers, booleans, null, arrays, objects).

        This method assumes the value_str is a literal and attempts to convert it
        to the appropriate Python type.

        Args:
            value_str (str): The string to parse.

        Returns:
            Any: The parsed value (str, int, float, bool, list, dict, None).

        Raises:
            UCLSyntaxError: If JSON array or object parsing fails.
        """
        value_str = value_str.strip()

        if value_str.lower() == 'null':
            return None

        if value_str.lower() in ['true', 'false']:
            return value_str.lower() == 'true'

        # Strings with quotes
        if (value_str.startswith('"') and value_str.endswith('"')) or \
           (value_str.startswith("'") and value_str.endswith("'")):
            return self._parse_string(value_str[1:-1])

        # Arrays (handled as UCL-specific array parsing)
        if value_str.startswith('[') and value_str.endswith(']'):
            return self._parse_array(value_str)

        # Objects (parsed as JSON)
        if value_str.startswith('{') and value_str.endswith('}'):
            try:
                return json.loads(value_str)
            except json.JSONDecodeError as e:
                raise UCLSyntaxError(f"Invalid JSON object: {e} in '{value_str}'")

        # Numbers (int or float)
        try:
            if '.' in value_str or 'e' in value_str.lower():
                return float(value_str)
            else:
                return int(value_str)
        except ValueError:
            pass

        # If none of the above, treat as a plain string
        return value_str

    def _parse_string(self, s: str) -> str:
        """
        Parse string content, handling common escape sequences.

        Supports: \n, \t, \r, \\, \", \'

        Args:
            s (str): The raw string content (without outer quotes).

        Returns:
            str: The string with escape sequences resolved.
        """
        escape_sequences = {
            'n': '\n',
            't': '\t',
            'r': '\r',
            '\\': '\\',
            '"': '"',
            "'": "'"
        }

        result = []
        i = 0
        while i < len(s):
            if s[i] == '\\' and i + 1 < len(s):
                next_char = s[i + 1]
                if next_char in escape_sequences:
                    result.append(escape_sequences[next_char])
                    i += 2  # Skip backslash and the escaped character
                else:
                    # Keep the backslash if it's not a recognized escape
                    result.append(s[i])
                    i += 1
            else:
                result.append(s[i])
                i += 1

        return ''.join(result)

    def _parse_array(self, array_str: str) -> List[Any]:
        """
        Parse array values from a string, supporting nested structures and proper
        splitting by commas outside of nested objects/arrays/strings.

        Args:
            array_str (str): The string representation of the array (e.g., "[1, 2, 'a']").

        Returns:
            List[Any]: The parsed list of elements.
        """
        content = array_str[1:-1].strip()  # Remove outer brackets

        if not content:
            return []

        # Replace newlines with spaces within the content for easier tokenization
        content = re.sub(r'\s*\n\s*', ' ', content)

        elements = []
        current_element = ""
        bracket_count = 0  # To track nested arrays
        brace_count = 0  # To track nested objects
        in_string = False
        quote_char = None
        i = 0

        while i < len(content):
            char = content[i]

            if not in_string and char in ['"', "'"]:
                in_string = True
                quote_char = char
                current_element += char
            elif in_string and char == quote_char:
                if i > 0 and content[i - 1] == '\\':
                    # It's an escaped quote within a string, keep it
                    current_element += char
                else:
                    # End of string literal
                    in_string = False
                    quote_char = None
                    current_element += char
            elif not in_string:
                if char == '[':
                    bracket_count += 1
                    current_element += char
                elif char == ']':
                    bracket_count -= 1
                    current_element += char
                elif char == '{':
                    brace_count += 1
                    current_element += char
                elif char == '}':
                    brace_count -= 1
                    current_element += char
                elif char == ',' and bracket_count == 0 and brace_count == 0:
                    # Only split by comma if not inside a nested structure or string
                    if current_element.strip():
                        elements.append(self._parse_value(current_element.strip()))
                    current_element = ""
                else:
                    current_element += char
            else:
                # Inside a string, just append the character
                current_element += char

            i += 1

        # Add the last element if any
        if current_element.strip():
            elements.append(self._parse_value(current_element.strip()))

        return elements

    def _evaluate_expression(self, expr: str) -> Any:
        """
        Evaluate arithmetic expressions and string concatenations, respecting operator precedence.

        Supports basic arithmetic (+, -, *, /, %) and string concatenation (+).
        Handles parentheses for grouping.

        Args:
            expr (str): The expression string.

        Returns:
            Any: The result of the evaluation (int, float, or str).

        Raises:
            UCLTypeError: If operands are incompatible for an operation.
            UCLReferenceError: If a reference within the expression cannot be resolved.
        """
        # First, evaluate expressions within parentheses
        # This loop continues until no more parentheses are found
        while '(' in expr:
            # Find the innermost opening parenthesis
            start = expr.rfind('(')
            if start == -1:  # No more opening parentheses
                break

            # Find the corresponding closing parenthesis
            end = expr.find(')', start)
            if end == -1:
                raise UCLSyntaxError(f"Mismatched parentheses in expression: {expr}")

            inner_expr = expr[start + 1:end]
            result = self._evaluate_simple_expression(inner_expr)
            # Replace the parenthesized expression with its result
            expr = expr[:start] + str(result) + expr[end + 1:]

        # Finally, evaluate the simplified expression (no parentheses)
        return self._evaluate_simple_expression(expr)

    def _evaluate_simple_expression(self, expr: str) -> Any:
        """
        Evaluate a simple expression (without parentheses) respecting operator precedence.

        Order of operations: *, /, % then +, - (including string concatenation).

        Args:
            expr (str): The expression string without parentheses.

        Returns:
            Any: The result of the evaluation.
        """
        tokens = self._tokenize_expression(expr)

        # First pass: Convert all literal/reference tokens to their Python values
        # and handle type conversions (like ".int") if they exist as a standalone token.
        for i, token in enumerate(tokens):
            if not self._is_operator(token):
                if self._is_simple_literal(token):
                    tokens[i] = self._parse_simple_value(token)
                elif self._is_variable_reference(token):
                    tokens[i] = self._resolve_reference(token)
                else:
                    # If it's neither a simple literal nor a reference,
                    # try parsing it as a simple value anyway (might be a plain word)
                    tokens[i] = self._parse_simple_value(token)

        # Second pass: Handle multiplication, division, and modulo
        i = 1
        while i < len(tokens):
            if i < len(tokens) and tokens[i] in ['*', '/', '%']:
                left = self._to_number(tokens[i - 1])
                right = self._to_number(tokens[i + 1])

                if tokens[i] == '*':
                    result = left * right
                elif tokens[i] == '/':
                    if right == 0:
                        raise UCLTypeError("Division by zero")
                    result = left / right
                else:  # Modulo
                    if right == 0:
                        raise UCLTypeError("Modulo by zero")
                    result = left % right

                # Replace the operand-operator-operand triplet with the result
                tokens = tokens[:i - 1] + [result] + tokens[i + 2:]
            else:
                i += 2  # Move to the next potential operator

        # Third pass: Handle addition and subtraction
        i = 1
        while i < len(tokens):
            if i < len(tokens) and tokens[i] in ['+', '-']:
                left = tokens[i - 1]
                right = tokens[i + 1]

                if tokens[i] == '+':
                    # String concatenation if either operand is a string
                    if isinstance(left, str) or isinstance(right, str):
                        result = str(left) + str(right)
                    else:
                        result = self._to_number(left) + self._to_number(right)
                else:  # Subtraction
                    result = self._to_number(left) - self._to_number(right)

                # Replace the operand-operator-operand triplet with the result
                tokens = tokens[:i - 1] + [result] + tokens[i + 2:]
            else:
                i += 2  # Move to the next potential operator

        return tokens[0] if tokens else None

    def _tokenize_expression(self, expr: str) -> List[str]:
        """
        Tokenize an expression string into a list of operands and operators.
        Handles quoted strings as single tokens.

        Args:
            expr (str): The expression string.

        Returns:
            List[str]: A list of tokens.
        """
        tokens = []
        current_token = ""
        in_string = False
        quote_char = None

        for char in expr:
            if not in_string and char in ['"', "'"]:
                # Start of a quoted string
                if current_token.strip():
                    tokens.append(current_token.strip())
                current_token = char
                in_string = True
                quote_char = char
            elif in_string and char == quote_char:
                # End of a quoted string
                current_token += char
                tokens.append(current_token)
                current_token = ""
                in_string = False
                quote_char = None
            elif not in_string and char in ['+', '-', '*', '/', '%']:
                # Operator encountered outside a string
                if current_token.strip():
                    tokens.append(current_token.strip())
                tokens.append(char)
                current_token = ""
            elif char.isspace() and not in_string:
                # Whitespace outside a string, finalize current token
                if current_token.strip():
                    tokens.append(current_token.strip())
                current_token = ""
            else:
                # Regular character, append to current token
                current_token += char

        if current_token.strip():
            tokens.append(current_token.strip())

        return tokens

    def _is_operator(self, token: str) -> bool:
        """
        Check if a given token is an arithmetic operator.

        Args:
            token (str): The token to check.

        Returns:
            bool: True if the token is an operator, False otherwise.
        """
        return token in ['+', '-', '*', '/', '%']

    def _to_number(self, value: Any) -> Union[int, float]:
        """
        Convert a value to an integer or float.

        Args:
            value (Any): The value to convert.

        Returns:
            Union[int, float]: The converted numeric value.

        Raises:
            UCLTypeError: If the value cannot be converted to a number.
        """
        if isinstance(value, (int, float)):
            return value

        try:
            # If it contains a dot or 'e' (for scientific notation), treat as float
            if isinstance(value, str) and ('.' in value or 'e' in value.lower()):
                return float(value)
            # Otherwise, try converting to integer
            else:
                return int(value)
        except ValueError:
            raise UCLTypeError(f"Cannot convert '{value}' to number")

    def _is_variable_reference(self, value_str: str) -> bool:
        """
        Check if a string likely represents a variable reference.

        A reference typically contains dots for nested access, or is a plain
        word that isn't a simple literal.

        Args:
            value_str (str): The string to check.

        Returns:
            bool: True if it appears to be a variable reference, False otherwise.
        """
        if self._is_simple_literal(value_str):
            return False

        # If it contains dots (e.g., "section.key")
        # Or if it's a plain word (e.g., "my_variable")
        # Ensure it's not empty and doesn't start/end with non-alphanumeric chars
        return '.' in value_str or bool(
            re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', value_str))

    def _resolve_reference(self, ref: str) -> Any:
        """
        Resolve a variable reference (e.g., "section.key", "myArray[0]", "myDict.key").

        This method attempts to find the value corresponding to the given reference
        path within the current configuration.

        Args:
            ref (str): The reference string.

        Returns:
            Any: The resolved value.

        Raises:
            UCLReferenceError: If the reference cannot be resolved.
        """
        if '[' in ref and ']' in ref:
            # Handle complex references with array/object access
            return self._resolve_complex_reference(ref)

        # Simple dot-separated reference
        parts = ref.split('.')
        current = self.config

        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                # If not found directly, try resolving relative to the current section
                if self.current_section:
                    # Construct full path from current section and the reference
                    potential_full_path = self.current_section + parts
                    try:
                        return self._get_nested_value('.'.join(potential_full_path))
                    except UCLReferenceError:
                        # If still not found, try the reference as absolute path
                        pass  # Fall through to original error if not found this way either

                raise UCLReferenceError(f"Cannot resolve reference: {ref}")

        return current

    def _resolve_complex_reference(self, ref: str) -> Any:
        """
        Resolve complex references involving array indexing and object key access.
        Examples: "myArray[0]", "myDict['key']", "nested.array[1].prop"

        Args:
            ref (str): The complex reference string.

        Returns:
            Any: The resolved value.

        Raises:
            UCLReferenceError: If any part of the reference cannot be resolved or is invalid.
        """
        base_ref = ""
        accessors = []  # Stores index (for arrays) or key (for objects)

        i = 0
        while i < len(ref):
            if ref[i] == '[':
                # Found an opening bracket, start parsing an accessor
                bracket_count = 1
                j = i + 1  # Start after '['
                accessor = ""

                while j < len(ref) and bracket_count > 0:
                    if ref[j] == '[':
                        bracket_count += 1
                    elif ref[j] == ']':
                        bracket_count -= 1

                    if bracket_count > 0:  # Add to accessor until matching ']' is found
                        accessor += ref[j]
                    j += 1

                if bracket_count != 0:
                    raise UCLSyntaxError(f"Mismatched brackets in reference: {ref}")

                accessors.append(accessor)
                i = j  # Move index past the closing bracket
            else:
                # Accumulate characters for the base reference until a bracket is found
                base_ref += ref[i]
                i += 1

        # Resolve the base reference first
        base_value = self._resolve_reference(base_ref)

        current = base_value
        for accessor in accessors:
            # Try to convert accessor to integer for array index
            if accessor.isdigit():
                index = int(accessor)
                if isinstance(current, list):
                    if 0 <= index < len(current):
                        current = current[index]
                    else:
                        raise UCLReferenceError(f"Array index out of bounds: {index} in {ref}")
                else:
                    raise UCLReferenceError(
                        f"Attempted to index a non-array value at '{base_ref}': {ref}")
            else:
                # Otherwise, treat as an object key (strip quotes if present)
                key = accessor.strip('"\'')
                if isinstance(current, dict):
                    if key in current:
                        current = current[key]
                    else:
                        raise UCLReferenceError(f"Object key not found: '{key}' in {ref}")
                else:
                    raise UCLReferenceError(
                        f"Attempted to access key on a non-object value at '{base_ref}': {ref}")
        return current

    def _convert_type(self, value: Any, target_type: str) -> Any:
        """
        Convert a given value to a specified target type.

        Args:
            value (Any): The value to convert.
            target_type (str): The target type ('int', 'float', 'string', 'bool').

        Returns:
            Any: The converted value.

        Raises:
            UCLTypeError: If the conversion is not possible or the target type is unknown.
        """
        if target_type == 'int':
            try:
                # Convert via float first to handle string floats like "123.0"
                return int(float(str(value)))
            except ValueError:
                raise UCLTypeError(f"Cannot convert '{value}' to int")

        elif target_type == 'float':
            try:
                return float(value)
            except ValueError:
                raise UCLTypeError(f"Cannot convert '{value}' to float")

        elif target_type == 'string':
            if isinstance(value, bool):
                return str(value).lower()  # "true" or "false"
            return str(value)

        elif target_type == 'bool':
            if isinstance(value, bool):
                return value
            elif isinstance(value, (int, float)):
                return value != 0  # 0 is False, any other number is True
            elif isinstance(value, str):
                lower_val = value.lower()
                if lower_val in ['true', 'yes', '1']:
                    return True
                elif lower_val in ['false', 'no', '0']:
                    return False
                else:
                    raise UCLTypeError(f"Cannot convert string '{value}' to bool")
            else:
                raise UCLTypeError(f"Cannot convert '{value}' to bool")

        else:
            raise UCLTypeError(f"Unknown target type: {target_type}")

    def _set_nested_value(self, key: str, value: Any) -> None:
        """
        Set a value within the configuration dictionary, respecting the current section.

        If `self.current_section` is `['a', 'b']` and `key` is `c`, this will set `config['a']['b']['c'] = value`.
        It creates intermediate dictionaries as needed.

        Args:
            key (str): The key for the value being set.
            value (Any): The value to set.
        """
        full_path = self.current_section + [key]

        current = self.config
        for part in full_path[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]

        current[full_path[-1]] = value

    def _get_nested_value(self, path: str) -> Any:
        """
        Get a nested value from the configuration dictionary using a dot-separated path.

        Args:
            path (str): The dot-separated path to the value (e.g., "section.subsection.key").

        Returns:
            Any: The value at the specified path.

        Raises:
            UCLReferenceError: If any part of the path does not exist.
        """
        parts = path.split('.')
        current = self.config

        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                raise UCLReferenceError(f"Path not found: {path}")

        return current

    def _apply_defaults(self) -> None:
        """
        Apply default values defined in the 'defaults' section to the configuration.

        Default values are applied only if the corresponding key is not explicitly
        set in the main configuration or if its value is `null`.
        """
        for path, default_value in self.defaults.items():
            try:
                current_value = self._get_nested_value(path)
                # Apply default only if current value is None
                if current_value is None:
                    self._set_nested_value_by_path(path, default_value)
            except UCLReferenceError:
                # If the path doesn't exist at all, apply the default
                self._set_nested_value_by_path(path, default_value)

    def _set_nested_value_by_path(self, path: str, value: Any) -> None:
        """
        Set a nested value in the configuration dictionary given a full dot-separated path.

        This method is similar to `_set_nested_value` but takes a full path string
        instead of relying on `current_section`.

        Args:
            path (str): The full dot-separated path to the key (e.g., "section.subsection.key").
            value (Any): The value to set.
        """
        parts = path.split('.')
        current = self.config

        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]

        current[parts[-1]] = value


def parse_ucl_file(filepath: Union[str, Path]) -> Dict[str, Any]:
    """
    Convenience function to parse a UCL file.

    Creates a new UCLParser instance and calls its `parse_file` method.

    Args:
        filepath (Union[str, Path]): The path to the UCL file.

    Returns:
        Dict[str, Any]: The parsed configuration dictionary.

    Raises:
        FileNotFoundError: If the specified file does not exist.
        UCLError: For any errors encountered during parsing.
    """
    parser = UCLParser()
    return parser.parse_file(filepath)


def parse_ucl_string(content: str) -> Dict[str, Any]:
    """
    Convenience function to parse UCL content from a string.

    Creates a new UCLParser instance and calls its `parse_string` method.

    Args:
        content (str): The UCL content as a string.

    Returns:
        Dict[str, Any]: The parsed configuration dictionary.

    Raises:
        UCLError: For any errors encountered during parsing.
    """
    parser = UCLParser()
    return parser.parse_string(content)