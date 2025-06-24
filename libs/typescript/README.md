# UCL Parser

A TypeScript/JavaScript parser for UCL (Universal Configuration Language) files with support for expressions, variable references, type conversions, and more.

## Features

- 🔧 **Flexible Configuration**: Parse UCL files with sections, nested objects, and arrays
- 🧮 **Expression Evaluation**: Support for arithmetic expressions and string concatenation
- 🔗 **Variable References**: Reference other configuration values with dot notation
- 🌍 **Environment Variables**: Access environment variables with `$ENV{VAR_NAME}`
- 🔄 **Type Conversion**: Explicit type conversion with `.int`, `.float`, `.string`, `.bool` suffixes
- 📁 **File Inclusion**: Include other UCL files with `include "path/to/file.ucl"`
- 🎯 **Default Values**: Define fallback values in a `[defaults]` section
- 💬 **Comments**: Support for single-line (`//`) and multi-line (`/* */`) comments
- 🏗️ **Complex References**: Array indexing and object property access (e.g., `users[0].name`)

## Installation

```bash
npm install ucl-parser
```

## Quick Start

```typescript
import { parseUclFile, parseUclString } from 'ucl-parser';

// Parse from file
const config = parseUclFile('./config.ucl');

// Parse from string
const configString = `
[database]
host = "localhost"
port = 5432
timeout = 30

[app]
name = "My App"
version = "1.0.0"
debug = true
`;

const config = parseUclString(configString);
console.log(config.database.host); // "localhost"
```

## Basic Syntax

### Sections
```ucl
[database]
host = "localhost"
port = 5432

[app.server]
bind_address = "0.0.0.0"
port = 8080
```

### Data Types
```ucl
# Strings
name = "John Doe"
description = 'Single quotes work too'

# Numbers
age = 25
price = 19.99

# Booleans
enabled = true
debug = false

# Null
value = null

# Arrays
tags = ["web", "api", "nodejs"]
numbers = [1, 2, 3, 4, 5]

# Objects (JSON syntax)
user = {
  "name": "Alice",
  "age": 30,
  "active": true
}
```

### Comments
```ucl
// Single line comment
name = "value"

/*
Multi-line
comment
*/
port = 8080
```

## Advanced Features

### Variable References
```ucl
[database]
host = "localhost"
port = 5432
url = "postgresql://" + host + ":" + port.string + "/mydb"

[app]
db_host = database.host  # References database.host
```

### Environment Variables
```ucl
[database]
host = $ENV{DB_HOST}
port = $ENV{DB_PORT}
password = $ENV{DB_PASSWORD}
```

### Type Conversion
```ucl
[config]
port_string = 8080.string    # "8080"
version_int = "1.5".int      # 1 (floored)
price_float = "19.99".float  # 19.99
enabled_bool = "true".bool   # true
```

### Expressions
```ucl
[math]
base = 10
doubled = base * 2           # 20
sum = base + doubled         # 30
message = "Result: " + sum.string  # "Result: 30"
```

### Complex References
```ucl
[users]
list = [
  {"name": "Alice", "age": 30},
  {"name": "Bob", "age": 25}
]

[display]
first_user = users.list[0].name     # "Alice"
second_age = users.list[1].age      # 25
```

### File Inclusion
```ucl
# main.ucl
include "database.ucl"
include "logging.ucl"

[app]
name = "My Application"
```

### Default Values
```ucl
[app]
name = "My App"
port = null  # Will use default

[defaults]
app.port = 3000
app.timeout = 30
```

## API Reference

### Functions

#### `parseUclFile(filepath: string): UCLObject`
Parse a UCL file and return the configuration object.

```typescript
import { parseUclFile } from 'ucl-parser';

const config = parseUclFile('./config.ucl');
```

#### `parseUclString(content: string): UCLObject`
Parse UCL content from a string.

```typescript
import { parseUclString } from 'ucl-parser';

const config = parseUclString(`
[app]
name = "Test App"
port = 3000
`);
```

### Classes

#### `UCLParser`
The main parser class for advanced usage.

```typescript
import { UCLParser } from 'ucl-parser';

const parser = new UCLParser();
const config = parser.parseFile('./config.ucl');
```

### Types

```typescript
type UCLValue = string | number | boolean | null | UCLArray | UCLObject;
type UCLArray = UCLValue[];
interface UCLObject {
  [key: string]: UCLValue;
}
```

### Error Classes

- `UCLError`: Base error class
- `UCLSyntaxError`: Syntax-related errors
- `UCLReferenceError`: Variable reference errors
- `UCLTypeError`: Type conversion errors

## Error Handling

```typescript
import { parseUclFile, UCLSyntaxError, UCLReferenceError } from 'ucl-parser';

try {
  const config = parseUclFile('./config.ucl');
} catch (error) {
  if (error instanceof UCLSyntaxError) {
    console.error('Syntax error:', error.message);
  } else if (error instanceof UCLReferenceError) {
    console.error('Reference error:', error.message);
  } else {
    console.error('Other error:', error.message);
  }
}
```

## Examples

See the [documentation](./docs.md) for more detailed examples and use cases.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.