# UCL Parser

A Python library for parsing Universal Configuration Language (UCL) files.

## Features

- Complete implementation of the UCL specification
- Support for all UCL data types (strings, numbers, booleans, arrays, objects, null)
- Arithmetic operations and string concatenation
- Variable references and complex path resolution
- Environment variable resolution
- Type conversion system
- Include/import functionality
- Defaults section support
- Comprehensive error handling

## Installation

```bash
pip install ucl-parser
```

## Quick Start

```python
from ucl_parser import parse_ucl_file, parse_ucl_string

# Parse from file
config = parse_ucl_file("config.ucl")

# Parse from string
config_string = """
[Database]
host = "localhost"
port = 5432
enabled = true
"""

config = parse_ucl_string(config_string)
print(config['Database']['host'])  # Output: localhost
```

## UCL Syntax Overview

UCL supports various data types and features:

### Basic Key-Value Pairs
```ucl
[Section]
key = "value"
number = 42
flag = true
```

### Arrays and Objects
```ucl
[Data]
list = [1, 2, 3, "four"]
config = {
    "nested": {
        "key": "value"
    }
}
```

### Variable References
```ucl
[Config]
base_url = "https://api.example.com"
full_url = base_url + "/v1/users"
```

### Environment Variables
```ucl
[Runtime]
api_key = $ENV{API_KEY}
debug = $ENV{DEBUG_MODE}
```

### Type Conversions
```ucl
[Conversions]
string_num = "123"
as_int = string_num.int
as_float = string_num.float
as_bool = "true".bool
```

## Testing

Run the test suite:

```bash
python -m pytest test_ucl_parser.py -v
```

## License

MIT License