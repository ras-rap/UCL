# Universal Configuration Language (UCL)

UCL is a simple, human-friendly configuration language designed for clear and intuitive setup of applications and services. It provides a straightforward way to define settings, supporting common data types and basic operations.

## Key Features

*   **Easy to Read:** Clear, straightforward syntax that's easy to understand at a glance.
*   **Comments:** Add notes to your configuration files for better clarity.
    *   Single-line: `// This is a comment`
    *   Multi-line: `/* This is a multi-line comment */`
*   **Organized Sections:** Group related settings using `[Section Names]` and nest them for hierarchy (e.g., `[Database.Connection]`).
*   **Key-Value Pairs:** Define your configurations using `key = value`.
*   **Common Data Types:**
    *   **Numbers:** `num = 123` or `float_num = 3.14`
    *   **Strings:** `"Hello World"` or `'Single-quoted string'`
    *   **Booleans:** `true` or `false`
    *   **Arrays (Lists):** `my_list = [1, 2, "three"]`. Arrays can also be nested: `nested_list = [1, [2, 3], 4]`.
    *   **Null:** Represents no value: `my_setting = null`
    *   **Embedded JSON:** For complex, structured data, you can embed standard JSON objects: `config = {"key": "value", "array": [1, 2]}`
*   **Basic Operations:**
    *   **Arithmetic:** Perform addition, subtraction, multiplication, division, and modulo on numbers: `result = num1 + num2`
    *   **String Concatenation:** Join strings together: `full_name = first + last`
    *   **Variable References:** Use previously defined values: `total = item_price + tax`
*   **Includes:** Break large configurations into smaller, reusable files: `include "path/to/another_file.ucl"`
*   **Environment Variables:** Inject values from your system's environment: `api_key = $ENV{MY_API_KEY}`
*   **Type Conversion:** Explicitly convert data types like `my_number.string` or `my_string.int`.
*   **Default Values Section:** Define fallback values in a dedicated `[Defaults]` section at the end of the file. These values are applied if a setting is not defined elsewhere or is explicitly set to `null`.

## Example

```ucl
// Global application settings
[App]
name = "My Application"
version = "1.0"
debug_mode = false
start_time = "2025-01-01T00:00:00Z"

// Database connection details
[Database.Connection]
type = "PostgreSQL"
host = "localhost"
port = 5432
username = "admin"
password = $ENV{DB_PASSWORD} // Get password from environment variable

// Array of enabled features
[Features]
enabled = ["analytics", "notifications", "search"]

// Nested arrays
permissions = [
    ["read", "write"],
    ["delete", "admin"]
]

// Calculations
item_count = 10
price_per_item = 2.5
total_cost = item_count * price_per_item // total_cost will be 25.0
remaining_items = item_count % 3 // remaining_items will be 1

// String manipulation
first_name = "Jane"
last_name = "Doe"
full_name = first_name + " " + last_name // full_name will be "Jane Doe"

// Explicitly no value
optional_id = null

// Type conversion
rate_str = "15.75"
shipping_cost_str = "5"
calculated_total = rate_str.float + shipping_cost_str.int // calculated_total will be 20.75
is_enabled_str = "true"
is_active_bool = is_enabled_str.bool // is_active_bool will be true

/*
 * The [Defaults] section defines fallback values.
 * These apply if a setting is not explicitly defined elsewhere,
 * or if it's set to 'null'.
 */
[Defaults]
App.log_level = "INFO" // Default log level for App section
Database.Connection.timeout_ms = 5000 // Default timeout for database connection
Features.experimental_enabled = false // Default for an optional feature
```

## File Extension

UCL files should use the `.ucl` extension.