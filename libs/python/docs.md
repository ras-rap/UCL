# UCLParser Documentation

This document provides a detailed overview of the `UCLParser` class and its functionalities for parsing Universal Configuration Language (UCL) files and strings.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation) (Assumed: Just put the file in your project)
- [Usage](#usage)
  - [Parsing a File](#parsing-a-file)
  - [Parsing a String](#parsing-a-string)
- [UCL Syntax and Features](#ucl-syntax-and-features)
  - [Comments](#comments)
  - [Includes](#includes)
  - [Sections](#sections)
  - [Key-Value Pairs](#key-value-pairs)
  - [Data Types](#data-types)
  - [Multi-line Values (JSON)](#multi-line-values-json)
  - [Environment Variables](#environment-variables)
  - [Variable References](#variable-references)
  - [Arithmetic Expressions and String Concatenation](#arithmetic-expressions-and-string-concatenation)
  - [Type Conversions](#type-conversions)
  - [Defaults Section](#defaults-section)
- [Error Handling](#error-handling)
- [Classes and Functions Reference](#classes-and-functions-reference)
  - [Exceptions](#exceptions)
  - [`UCLParser` Class](#uclparser-class)
  - [Convenience Functions](#convenience-functions)

## Overview

The `UCLParser` is a Python class designed to parse configuration files written in a custom Universal Configuration Language (UCL). It supports a rich set of features, including:

- **Comments**: Single-line (`//`) and multi-line (`/* ... */`) comments.
- **Includes**: Ability to include other UCL files, allowing for modular configuration.
- **Sections**: Organize configuration into hierarchical sections using bracket notation (`[section.subsection]`).
- **Key-Value Pairs**: Standard `key = value` assignment.
- **Data Types**: Automatic recognition of strings, numbers (integers and floats), booleans, null, arrays, and objects (JSON-compatible syntax).
- **Multi-line Values**: Support for JSON objects and arrays spanning multiple lines.
- **Environment Variable Resolution**: Resolve values from system environment variables (`$ENV{VAR_NAME}`).
- **Variable References**: Reference other configuration values dynamically within the same file (`my.other.setting`).
- **Arithmetic Expressions**: Evaluate simple arithmetic expressions (`1 + 2 * 3`) and string concatenations.
- **Type Conversions**: Explicitly convert values to a desired type (`"123".int`).
- **Defaults Section**: Define default values that are applied if a configuration key is missing or explicitly `null`.

## Installation

This parser is provided as a single Python file. To use it, simply place the `ucl_parser.py` (or whatever you named the file) in your project and import it.

## Usage

### Parsing a File

To parse a UCL configuration file:

```python
from ucl_parser import parse_ucl_file

try:
    config = parse_ucl_file("config.ucl")
    print(config)
except Exception as e:
    print(f"Error parsing UCL file: {e}")
```

### Parsing a String

To parse UCL content directly from a string:

```python
from ucl_parser import parse_ucl_string

ucl_content = """
    app_name = "My Application"
    version = 1.0
    [database]
        host = "localhost"
        port = 5432
        enabled = true
"""

try:
    config = parse_ucl_string(ucl_content)
    print(config)
    # Output: {'app_name': 'My Application', 'version': 1.0, 'database': {'host': 'localhost', 'port': 5432, 'enabled': True}}
except Exception as e:
    print(f"Error parsing UCL string: {e}")
```

## UCL Syntax and Features

### Comments

The parser supports two types of comments:

- **Single-line comments**: Start with `//`. Everything from `//` to the end of the line is ignored.
  ```ucl
  // This is a single-line comment
  key = value // This comment starts after the value
  ```
- **Multi-line comments**: Enclosed within `/*` and `*/`. These can span multiple lines.
  ```ucl
  /*
   * This is a multi-line comment.
   * It can describe multiple lines of configuration.
   */
  another_key = "another value"
  ```

### Includes

You can include other UCL files into your main configuration using the `include` directive:

```ucl
// main.ucl
include "common_settings.ucl"
[app]
    name = "My App"
```

```ucl
// common_settings.ucl
[network]
    timeout = 10
    retries = 3
```

The content of `common_settings.ucl` will be effectively inserted into `main.ucl` at the point of the `include` directive. Paths are relative to the including file. Includes are processed recursively.

### Sections

Configuration can be organized into hierarchical sections using square brackets:

```ucl
[server]
    ip = "127.0.0.1"

[server.http] // Nested section
    port = 8080
    enabled = true

[server.https]
    port = 8443
    ssl_enabled = true
```

This will result in a Python dictionary structure like:

```python
{
    'server': {
        'ip': '127.0.0.1',
        'http': {
            'port': 8080,
            'enabled': True
        },
        'https': {
            'port': 8443,
            'ssl_enabled': True
        }
    }
}
```

### Key-Value Pairs

The fundamental building block of UCL is the key-value pair, separated by an equals sign `=`.

```ucl
setting_name = "some string"
another_setting = 123
```

Keys can contain alphanumeric characters and underscores. Values can be various data types.

### Data Types

The parser automatically infers data types:

- **Strings**: Enclosed in single (`'`) or double (`"`) quotes. Supports standard escape sequences (`\n`, `\t`, `\r`, `\"`, `\'`, `\\`).
  ```ucl
  my_string = "Hello, World!"
  path = 'C:\\Program Files\\App'
  newline_text = "Line1\nLine2"
  ```
- **Numbers**: Integers and floating-point numbers.
  ```ucl
  integer_val = 100
  float_val = 3.14159
  scientific_val = 6.022e23
  ```
- **Booleans**: `true` or `false` (case-insensitive).
  ```ucl
  debug_mode = true
  production_env = FALSE
  ```
- **Null**: `null` (case-insensitive).
  ```ucl
  optional_setting = null
  ```
- **Arrays**: JSON-like arrays enclosed in `[]`. Elements are comma-separated.
  ```ucl
  my_list = [1, 2, "three", true, null]
  ```
- **Objects**: JSON-like objects enclosed in `{}`. Keys are strings, values can be any type.
  ```ucl
  user_info = {
      "name": "Alice",
      "age": 30,
      "is_active": true
  }
  ```

### Multi-line Values (JSON)

JSON objects and arrays can span multiple lines. The parser correctly identifies the end of the multi-line structure by balancing braces `{}` or brackets `[]`.

```ucl
complex_data = {
    "item1": 123,
    "item2": [
        "sub-item-a",
        "sub-item-b"
    ],
    "nested_obj": {
        "prop_a": "value_a",
        "prop_b": 45.6
    }
}

another_list = [
    "element_1",
    { "id": 1, "status": "active" },
    "element_3"
]
```

### Environment Variables

You can reference system environment variables using the `$ENV{VAR_NAME}` syntax:

```ucl
database_user = "$ENV{DB_USERNAME}"
log_dir = "$ENV{LOG_PATH}"
```
If `DB_USERNAME` is set to `admin` in your environment, `database_user` will be parsed as `admin`.

### Variable References

Values can refer to other values defined in the configuration. References are dot-separated paths to keys. They can be absolute or relative to the current section.

```ucl
[application]
    base_url = "http://api.example.com"
    users_endpoint = application.base_url + "/users" // Absolute reference
    port = 8080

[application.api]
    version = "v1"
    full_url = base_url + "/" + version // Relative reference to base_url
    max_connections = port * 2 // Using a numeric reference
```

**Complex References (Array/Object Access)**: You can access elements within arrays using `[index]` and properties within objects using `['key']` or `[key]` (if key is valid identifier):

```ucl
[data]
    users = [
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"}
    ]
    first_user_name = data.users[0].name
    second_user_id = data.users[1]["id"] // Quoted key for object property
```

### Arithmetic Expressions and String Concatenation

The parser can evaluate simple arithmetic expressions and concatenate strings using the `+` operator. Operator precedence (`*`, `/`, `%` before `+`, `-`) and parentheses `()` are respected.

```ucl
count = 10 + 5 * 2 // Result: 20
total_price = (15.50 + 2.00) * 1.08 // Result: 18.90
message = "Hello, " + "World!" // Result: "Hello, World!"
version_string = "App Version: " + app_version // Mix string and number (app_version is a reference)
remainder = 17 % 5 // Result: 2
```

### Type Conversions

You can explicitly cast a value to a different type by appending `.type` to it. This is useful when the parser might infer a different type than intended, or when chaining operations.

Supported target types: `int`, `float`, `string`, `bool`.

```ucl
string_to_int = "123".int        // Result: 123 (integer)
float_to_string = 3.14.string    // Result: "3.14" (string)
bool_from_num = 1.bool           // Result: true (boolean)
bool_from_string = "false".bool  // Result: false (boolean)
int_from_float_str = "45.6".int  // Result: 45 (integer)
```

### Defaults Section

A special `[defaults]` section can be defined at the very end of the UCL file. Any key-value pair in this section specifies a default value for a configuration key. If a key is not defined elsewhere in the configuration, or if it is explicitly set to `null`, its default value from this section will be applied.

```ucl
// config.ucl
[logging]
    level = "INFO"
    file_path = null // This will be overridden by default

[network]
    timeout = 5 // This value is explicit, default won't apply

[defaults]
    logging.level = "DEBUG" // This will not apply as 'INFO' is set
    logging.file_path = "/var/log/app.log" // This will apply because it's null
    network.retries = 3 // This will apply as it's not defined in [network]
    server.port = 8000 // This will apply if server.port is not defined
```

## Error Handling

The parser defines custom exceptions for different types of errors:

- `UCLError`: Base exception for all UCL parsing errors.
- `UCLSyntaxError`: Raised when there's a problem with the UCL syntax (e.g., mismatched brackets, invalid key-value format).
- `UCLReferenceError`: Raised when a variable reference cannot be resolved (e.g., referencing a non-existent key or array index out of bounds).
- `UCLTypeError`: Raised when a type conversion fails (e.g., trying to convert "hello" to an integer) or during incompatible arithmetic operations.

It is recommended to wrap parser calls in a `try...except UCLError` block to catch any parsing issues.

## Classes and Functions Reference

### Exceptions

- `class UCLError(Exception)`: Base exception for UCL parsing errors.
- `class UCLSyntaxError(UCLError)`: Raised for syntax errors in the UCL file.
- `class UCLReferenceError(UCLError)`: Raised when a variable reference cannot be resolved.
- `class UCLTypeError(UCLError)`: Raised when type conversion or arithmetic operation fails.

### `UCLParser` Class

```python
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
        # ... (internal attributes) ...

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
        # ... (implementation details) ...

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
        # ... (implementation details) ...

    # Private methods (e.g., _remove_comments, _process_includes, etc.) are internal
    # to the parser's operation and typically not called directly by users.
```

### Convenience Functions

- `def parse_ucl_file(filepath: Union[str, Path]) -> Dict[str, Any]:`
  A convenience wrapper function that creates a `UCLParser` instance and calls its `parse_file` method.

- `def parse_ucl_string(content: str) -> Dict[str, Any]:`
  A convenience wrapper function that creates a `UCLParser` instance and calls its `parse_string` method.