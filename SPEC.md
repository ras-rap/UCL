# Universal Configuration Language (UCL) Specification

## 1. Introduction

Universal Configuration Language (UCL) is a human-readable, flexible, and extensible configuration language designed for declarative data representation. It provides a clear and intuitive syntax while supporting common data structures and operations for application and service configuration.

## 2. Lexical Structure

### 2.1 Comments

Comments are non-executing elements used for documentation within the configuration file.

*   **Single-line comments:** Start with `//` and extend to the end of the current line.

    ```ucl
    // This is a single-line comment
    key = value // Inline comment
    ```

*   **Multi-line comments:** Start with `/*` and terminate with `*/`. Multi-line comments can span multiple lines.

    ```ucl
    /*
     * This is a multi-line comment.
     * It can span across several lines
     * of the configuration file.
     */
    ```

### 2.2 Whitespace

Whitespace characters (spaces, tabs, newlines) are generally ignored by the parser, except within string literals. They serve to improve readability.

### 2.3 Identifiers

Identifiers (keys) must begin with an alphabetic character (a-z, A-Z) or an underscore (`_`), followed by any combination of alphanumeric characters (a-z, A-Z, 0-9) or underscores. Identifiers are case-sensitive.

```ucl
my_key = "value"
MyKey = "another value" // Different from my_key
```

## 3. Syntax Structure

### 3.1 Key-Value Pairs

The fundamental building block of UCL is the key-value pair.

*   **Syntax:** `key = value`
*   **Semantics:** Associates a `key` (identifier) with a `value` (data type or expression result).

    ```ucl
    setting = "some_value"
    port = 8080
    ```

### 3.2 Sections

Sections provide a mechanism for organizing configuration parameters hierarchically.

*   **Declaration:** Sections are declared using a name enclosed in square brackets `[]`.

    ```ucl
    [Section Name]
    ```

*   **Nesting:** Sections can be nested to create a deeper hierarchy using a dot `.` as a separator. Each dot implies a sub-level.

    ```ucl
    [Network.HTTP.Server]
    port = 8080

    [Network.HTTP.Client]
    timeout_ms = 5000
    ```

## 4. Data Types

UCL supports the following intrinsic data types:

### 4.1 Numbers

Represent both integer and floating-point numeric values.

```ucl
integer_value = 123
float_value = 3.14159
negative_value = -10
```

### 4.2 Strings

Represent sequences of characters.

*   **Declaration:** Enclosed in double quotes `"` or single quotes `'`. Both are equivalent.

    ```ucl
    double_quoted = "Hello World"
    single_quoted = 'Another string'
    ```

*   **Escape Sequences:** The backslash `\` character is used to escape special characters within string literals. Supported escape sequences include:
    *   `\"`: Double quote
    *   `\'`: Single quote
    *   `\\`: Backslash
    *   `\n`: Newline
    *   `\t`: Tab
    *   `\r`: Carriage return

    ```ucl
    escaped_quote = "This has a \"quote\" inside."
    new_line = "First line\nSecond line"
    ```

### 4.3 Booleans

Represent logical truth values.

*   **Values:** `true` or `false`. These values are case-insensitive (`True`, `TRUE`, `False`, `FALSE` are also valid).

    ```ucl
    is_enabled = true
    debug_mode = FALSE
    ```

### 4.4 Arrays (Lists)

Ordered collections of values.

*   **Declaration:** Enclosed in square brackets `[]`, with elements separated by commas `,`.
*   **Heterogeneous Types:** Arrays can contain values of different data types.
*   **Nested Arrays:** Arrays can contain other arrays, enabling multi-dimensional structures.

    ```ucl
    simple_array = [1, 2, "three", true]
    nested_array = [10, ["sub_a", "sub_b"], 20]
    ```

### 4.5 Objects (Embedded JSON)

Unordered collections of key-value pairs, primarily for complex structured data. UCL integrates standard JSON object syntax for this purpose.

*   **Declaration:** JSON objects are declared using curly braces `{}` with key-value pairs separated by colons `:` and entries separated by commas `,`. Keys must be strings (double-quoted).

    ```ucl
    complex_config = {
        "database": {
            "host": "localhost",
            "port": 5432
        },
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]
    }
    ```

### 4.6 Null

Represents the explicit absence of a value.

*   **Value:** `null` (case-insensitive).

    ```ucl
    optional_setting = null
    ```

## 5. Operations and Expressions

UCL supports basic operations for constructing values.

### 5.1 Arithmetic Operations

Supported binary arithmetic operators for numeric values:

*   **Addition:** `+`
*   **Subtraction:** `-`
*   **Multiplication:** `*`
*   **Division:** `/`
*   **Modulo:** `%` (remainder of division)

```ucl
num1 = 7
num2 = 4
sum = num1 + num2        // 11
difference = num1 - num2 // 3
product = num1 * num2    // 28
quotient = num1 / num2   // 1.75
remainder = num1 % num2  // 3
```

### 5.2 String Concatenation

The `+` operator is used to concatenate two string values.

```ucl
first_part = "Hello, "
second_part = "World!"
full_message = first_part + second_part // "Hello, World!"
```

### 5.3 Variable References

Values can reference previously defined keys within the same scope. The value of the referenced key is substituted. References can span across sections using dot notation for nested keys.

```ucl
[Settings]
base_port = 8000
api_port = base_port + 80 // api_port will be 8080

[Database]
db_host = "localhost"
connection_string = "Host=" + db_host // "Host=localhost"
```

## 6. Advanced Features

### 6.1 Includes/Imports

The `include` directive allows embedding the content of another UCL file into the current one at the point of the directive. This promotes modularity and reusability of configuration segments.

*   **Syntax:** `include "path/to/file.ucl"`
*   **Semantics:** The parser substitutes the `include` directive with the parsed content of the specified file. Paths can be relative to the current file or absolute. Includes are processed sequentially. If a key is redefined in an included file, the redefinition takes precedence for subsequent references.

    ```ucl
    // main.ucl
    include "common/database.ucl"
    include "server_config.ucl"

    [Application]
    name = "MyApp"

    // common/database.ucl
    [Database]
    host = "127.0.0.1"
    port = 5432
    ```

### 6.2 Environment Variable Resolution

Values can be dynamically sourced from system environment variables. This is particularly useful for sensitive information or deployment-specific settings that should not be hardcoded in the configuration file.

*   **Syntax:** `$ENV{VARIABLE_NAME}`
*   **Semantics:** The parser attempts to retrieve the value of the environment variable named `VARIABLE_NAME`. If the environment variable is not set, the behavior (e.g., error, `null` value) is implementation-defined but typically results in `null` or a configurable error.

    ```ucl
    api_key = $ENV{MY_APP_API_KEY}
    debug_mode = $ENV{DEBUG_FLAG} // If DEBUG_FLAG="true", debug_mode would be true.
    ```

### 6.3 Data Type Coercion/Conversion

UCL supports both implicit and explicit type conversions.

*   **Implicit Coercion:** The parser will attempt to automatically convert data types where the context makes the intention unambiguous. For example, a number might be implicitly converted to a string when concatenated with a string.

    ```ucl
    version_num = 1.0
    app_version = "App " + version_num // app_version will be "App 1.0"
    ```

*   **Explicit Conversion:** Values can be explicitly converted to a target data type using a dot notation. If a conversion is not possible (e.g., converting "abc" to an integer), a parsing error must be raised.

    *   `value.int`: Converts `value` to an integer.
    *   `value.float`: Converts `value` to a floating-point number.
    *   `value.string`: Converts `value` to a string.
    *   `value.bool`: Converts `value` to a boolean. Rules for string-to-boolean conversion: typically "true", "yes", "1" (case-insensitive) convert to `true`, and "false", "no", "0" (case-insensitive) convert to `false`. Other strings may cause an error. Numeric `0` converts to `false`, any non-zero number to `true`.

    ```ucl
    str_val = "123"
    int_val = str_val.int + 7 // int_val will be 130

    bool_str = "TRUE"
    bool_val = bool_str.bool // bool_val will be true

    num_val = 99
    string_representation = num_val.string + " bottles" // "99 bottles"
    ```

### 6.4 Defaults Section

The `[Defaults]` section provides fallback values for configuration parameters. This section must appear at the **very end** of the UCL file.

*   **Syntax:** A dedicated section named `[Defaults]`, containing key-value pairs using the standard UCL syntax. The keys in this section use full path notation (e.g., `Section.SubSection.key`).

    ```ucl
    // ... other configurations ...

    [Defaults]
    Application.log_level = "INFO"
    Database.Connection.timeout_ms = 5000
    Features.experimental_enabled = false
    ```

*   **Semantics:** After the entire UCL file (including any `include` directives) has been parsed and all primary key-value assignments have been resolved:
    1.  For every key defined in the `[Defaults]` section, the parser checks if the corresponding key in the primary configuration (from other sections) is either **undefined** or explicitly set to `null`.
    2.  If the primary key is undefined or `null`, its value is then set to the value specified in the `[Defaults]` section.
    3.  If the primary key has any non-`null` value, the default value is ignored, and the primary value is retained.

    This ensures that explicitly set values always take precedence over defaults, and defaults only fill in the gaps.

## 7. Semantic Rules

*   **Order of Operations:** Standard mathematical order of operations (parentheses, multiplication/division/modulo, addition/subtraction) applies to expressions.
*   **Case Sensitivity:** Keys and specific boolean/null literals (`true`, `false`, `null`) are case-insensitive. All other string values are case-sensitive.
*   **Redefinition:** If a key is defined multiple times within the same section and scope (excluding the `[Defaults]` section), the last definition encountered takes precedence and overwrites previous definitions.
*   **Error Handling:** Implementations should provide clear error messages for syntax errors, unresolvable variable references (if no default applies), invalid type conversions, and missing included files.

## 8. File Extension

The canonical file extension for Universal Configuration Language files is `.ucl`.