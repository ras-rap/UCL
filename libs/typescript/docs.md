# UCL Parser Documentation

This document provides comprehensive documentation for the UCL Parser library, including detailed examples, advanced usage patterns, and best practices.

## Table of Contents

1. [Basic Configuration](#basic-configuration)
2. [Data Types](#data-types)
3. [Sections and Nesting](#sections-and-nesting)
4. [Variable References](#variable-references)
5. [Environment Variables](#environment-variables)
6. [Expressions](#expressions)
7. [Type Conversion](#type-conversion)
8. [File Inclusion](#file-inclusion)
9. [Default Values](#default-values)
10. [Complex References](#complex-references)
11. [Error Handling](#error-handling)
12. [Best Practices](#best-practices)
13. [Migration Guide](#migration-guide)

## Basic Configuration

UCL (Universal Configuration Language) provides a flexible way to define configuration with a simple key-value syntax.

### Simple Key-Value Pairs

```ucl
# Basic configuration
app_name = "My Application"
version = "1.0.0"
debug = true
port = 8080
```

### Comments

UCL supports both single-line and multi-line comments:

```ucl
// This is a single-line comment
app_name = "My App"

/*
This is a multi-line comment
that spans multiple lines
*/
port = 8080

# Hash-style comments are NOT supported
```

## Data Types

UCL supports all standard JSON data types plus some extensions.

### Strings

```ucl
# Double quotes
name = "John Doe"
message = "Hello, World!"

# Single quotes
title = 'My Application'
description = 'This is a description'

# Escape sequences
path = "C:\\Users\\John\\Documents"
newline = "Line 1\nLine 2"
quote = "He said \"Hello\""
```

### Numbers

```ucl
# Integers
age = 25
count = -10
zero = 0

# Floats
price = 19.99
temperature = -5.5
pi = 3.14159
```

### Booleans

```ucl
# Boolean values (case-insensitive)
enabled = true
debug = false
production = TRUE
testing = False
```

### Null Values

```ucl
# Null values
empty_value = null
missing_config = NULL
```

### Arrays

```ucl
# Simple arrays
numbers = [1, 2, 3, 4, 5]
names = ["Alice", "Bob", "Charlie"]
mixed = [1, "two", true, null]

# Multi-line arrays
servers = [
  "server1.example.com",
  "server2.example.com",
  "server3.example.com"
]

# Nested arrays
matrix = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]
```

### Objects

Objects use JSON syntax:

```ucl
# Simple object
user = {
  "name": "Alice",
  "age": 30,
  "active": true
}

# Multi-line object
database = {
  "host": "localhost",
  "port": 5432,
  "credentials": {
    "username": "admin",
    "password": "secret"
  }
}
```

## Sections and Nesting

Sections provide a way to organize configuration hierarchically.

### Basic Sections

```ucl
[database]
host = "localhost"
port = 5432
name = "myapp"

[logging]
level = "info"
file = "/var/log/app.log"
```

Results in:
```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "myapp"
  },
  "logging": {
    "level": "info",
    "file": "/var/log/app.log"
  }
}
```

### Nested Sections

```ucl
[app.server]
host = "0.0.0.0"
port = 8080

[app.database]
host = "localhost"
port = 5432

[app.cache.redis]
host = "localhost"
port = 6379
```

Results in:
```json
{
  "app": {
    "server": {
      "host": "0.0.0.0",
      "port": 8080
    },
    "database": {
      "host": "localhost",
      "port": 5432
    },
    "cache": {
      "redis": {
        "host": "localhost",
        "port": 6379
      }
    }
  }
}
```

## Variable References

Reference other configuration values using dot notation.

### Simple References

```ucl
[database]
host = "localhost"
port = 5432

[app]
db_host = database.host        # "localhost"
db_port = database.port        # 5432
```

### Relative References

Within a section, you can reference other keys in the same section:

```ucl
[server]
host = "localhost"
port = 8080
url = "http://" + host + ":" + port.string
```

### Cross-Section References

```ucl
[database]
host = "db.example.com"
port = 5432

[cache]
host = "cache.example.com"
port = 6379

[app]
db_connection = database.host + ":" + database.port.string
cache_connection = cache.host + ":" + cache.port.string
```

## Environment Variables

Access environment variables using the `$ENV{VAR_NAME}` syntax.

### Basic Environment Variables

```ucl
[database]
host = $ENV{DB_HOST}
port = $ENV{DB_PORT}
username = $ENV{DB_USER}
password = $ENV{DB_PASSWORD}

[app]
secret_key = $ENV{SECRET_KEY}
debug = $ENV{DEBUG}
```

### Environment Variables with Fallbacks

Use default values when environment variables might not be set:

```ucl
[app]
port = $ENV{PORT}
debug = $ENV{DEBUG}

[defaults]
app.port = 3000
app.debug = false
```

## Expressions

UCL supports arithmetic expressions and string concatenation.

### Arithmetic Operations

```ucl
[math]
base = 10
doubled = base * 2              # 20
sum = base + doubled            # 30
difference = doubled - base     # 10
quotient = doubled / base       # 2
remainder = 23 % base           # 3

# Parentheses for grouping
complex = (base + 5) * 2        # 30
```

### String Concatenation

```ucl
[app]
name = "MyApp"
version = "1.0.0"
full_name = name + " v" + version    # "MyApp v1.0.0"

[database]
host = "localhost"
port = 5432
url = "postgresql://" + host + ":" + port.string + "/mydb"
```

### Mixed Expressions

```ucl
[config]
base_port = 8000
instance = 3
actual_port = base_port + instance   # 8003
server_name = "server-" + instance.string  # "server-3"
```

## Type Conversion

Explicitly convert values between types using suffixes.

### Available Conversions

```ucl
[conversions]
# String to number
port_num = "8080".int           # 8080
price_float = "19.99".float     # 19.99

# Number to string
port_str = 8080.string          # "8080"
price_str = 19.99.string        # "19.99"

# String to boolean
debug_bool = "true".bool        # true
enabled_bool = "yes".bool       # true
disabled_bool = "no".bool       # false

# Boolean to string
debug_str = true.string         # "true"
enabled_str = false.string      # "false"

# Number to boolean (0 = false, non-zero = true)
zero_bool = 0.bool              # false
nonzero_bool = 42.bool          # true
```

### Type Conversion in Expressions

```ucl
[app]
base_port = 8000
instance_id = "3"
# Convert string to int for arithmetic, then back to string for concatenation
port = base_port + instance_id.int                    # 8003
server_url = "http://localhost:" + port.string        # "http://localhost:8003"
```

## File Inclusion

Include other UCL files to organize large configurations.

### Basic Inclusion

**main.ucl:**
```ucl
include "database.ucl"
include "logging.ucl"

[app]
name = "My Application"
version = "1.0.0"
```

**database.ucl:**
```ucl
[database]
host = "localhost"
port = 5432
name = "myapp"
```

**logging.ucl:**
```ucl
[logging]
level = "info"
file = "/var/log/app.log"
format = "json"
```

### Relative Paths

Includes are resolved relative to the file containing the include statement:

```ucl
# In config/main.ucl
include "database/postgres.ucl"
include "../shared/logging.ucl"
```

### Nested Includes

Included files can themselves include other files:

**main.ucl:**
```ucl
include "services.ucl"
```

**services.ucl:**
```ucl
include "database.ucl"
include "cache.ucl"
include "queue.ucl"
```

## Default Values

Define fallback values in a special `[defaults]` section.

### Basic Defaults

```ucl
[app]
name = "My App"
port = null              # Will use default
timeout = null           # Will use default

[database]
host = "localhost"       # Explicit value, won't use default
port = null              # Will use default

[defaults]
app.port = 3000
app.timeout = 30
database.port = 5432
database.timeout = 10
```

### Defaults with Environment Variables

```ucl
[app]
port = $ENV{PORT}        # May be null if not set
debug = $ENV{DEBUG}      # May be null if not set

[defaults]
app.port = 3000
app.debug = false
```

### Complex Default Values

```ucl
[cache]
servers = null

[defaults]
cache.servers = ["localhost:6379", "localhost:6380"]
```

## Complex References

Access array elements and object properties using bracket notation.

### Array Indexing

```ucl
[servers]
list = ["web1.example.com", "web2.example.com", "web3.example.com"]

[load_balancer]
primary = servers.list[0]        # "web1.example.com"
secondary = servers.list[1]      # "web2.example.com"
```

### Object Property Access

```ucl
[users]
admin = {
  "name": "Administrator",
  "email": "admin@example.com",
  "permissions": ["read", "write", "admin"]
}

[notifications]
admin_email = users.admin["email"]                    # "admin@example.com"
admin_name = users.admin["name"]                      # "Administrator"
first_permission = users.admin["permissions"][0]     # "read"
```

### Nested Complex References

```ucl
[database]
clusters = [
  {
    "name": "primary",
    "nodes": [
      {"host": "db1.example.com", "port": 5432},
      {"host": "db2.example.com", "port": 5432}
    ]
  },
  {
    "name": "secondary", 
    "nodes": [
      {"host": "db3.example.com", "port": 5432}
    ]
  }
]

[app]
primary_db = database.clusters[0].nodes[0].host      # "db1.example.com"
primary_port = database.clusters[0].nodes[0].port   # 5432
secondary_db = database.clusters[1].nodes[0].host   # "db3.example.com"
```

## Error Handling

UCL Parser provides specific error types for different failure scenarios.

### Error Types

```typescript
import { 
  parseUclFile, 
  UCLError, 
  UCLSyntaxError, 
  UCLReferenceError, 
  UCLTypeError 
} from 'ucl-parser';

try {
  const config = parseUclFile('./config.ucl');
} catch (error) {
  if (error instanceof UCLSyntaxError) {
    // Invalid UCL syntax
    console.error('Syntax error:', error.message);
  } else if (error instanceof UCLReferenceError) {
    // Variable reference couldn't be resolved
    console.error('Reference error:', error.message);
  } else if (error instanceof UCLTypeError) {
    // Type conversion failed
    console.error('Type error:', error.message);
  } else if (error instanceof UCLError) {
    // Other UCL-related errors (file not found, etc.)
    console.error('UCL error:', error.message);
  } else {
    // Unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

### Common Error Scenarios

#### Syntax Errors

```ucl
# Missing quotes
name = Hello World  # Error: Invalid syntax

# Mismatched brackets
array = [1, 2, 3    # Error: Mismatched brackets

# Invalid key-value syntax
invalid line        # Error: Line without equals sign
```

#### Reference Errors

```ucl
[app]
port = database.port  # Error: database section doesn't exist

[database]
host = "localhost"
# port is not defined

[app]
db_port = database.port  # Error: database.port doesn't exist
```

#### Type Errors

```ucl
[app]
port = "not-a-number".int  # Error: Cannot convert to int
enabled = "maybe".bool     # Error: Cannot convert to bool
```

## Best Practices

### 1. Organization

**Good:**
```ucl
# Group related configuration
[database]
host = "localhost"
port = 5432
pool_size = 10

[cache]
host = "localhost"
port = 6379
ttl = 3600

[logging]
level = "info"
format = "json"
```

**Avoid:**
```ucl
# Mixed configuration at root level
db_host = "localhost"
cache_port = 6379
log_level = "info"
db_port = 5432
```

### 2. Use Environment Variables for Secrets

**Good:**
```ucl
[database]
host = $ENV{DB_HOST}
username = $ENV{DB_USER}
password = $ENV{DB_PASSWORD}

[defaults]
database.host = "localhost"
```

**Avoid:**
```ucl
[database]
password = "hardcoded-secret"  # Never do this!
```

### 3. Provide Sensible Defaults

**Good:**
```ucl
[app]
port = $ENV{PORT}
timeout = $ENV{TIMEOUT}
workers = $ENV{WORKERS}

[defaults]
app.port = 3000
app.timeout = 30
app.workers = 4
```

### 4. Use File Inclusion for Large Configs

**Good:**
```ucl
# main.ucl
include "database.ucl"
include "cache.ucl"
include "logging.ucl"
include "monitoring.ucl"

[app]
name = "My Application"
```

**Avoid:**
```ucl
# One massive file with hundreds of lines
```

### 5. Comment Complex Expressions

**Good:**
```ucl
[app]
# Calculate total memory: base + (workers * memory_per_worker)
total_memory = base_memory + (worker_count * worker_memory)
```

### 6. Use Type Conversion Explicitly

**Good:**
```ucl
[app]
port = $ENV{PORT}
# Ensure port is treated as string in URL
url = "http://localhost:" + port.string
```

## Migration Guide

### From JSON

**JSON:**
```json
{
  "database": {
    "host": "localhost",
    "port": 5432
  },
  "app": {
    "name": "My App",
    "debug": true
  }
}
```

**UCL:**
```ucl
[database]
host = "localhost"
port = 5432

[app]
name = "My App"
debug = true
```

### From YAML

**YAML:**
```yaml
database:
  host: localhost
  port: 5432
  
app:
  name: My App
  debug: true
  servers:
    - web1.example.com
    - web2.example.com
```

**UCL:**
```ucl
[database]
host = "localhost"
port = 5432

[app]
name = "My App"
debug = true
servers = ["web1.example.com", "web2.example.com"]
```

### From TOML

**TOML:**
```toml
[database]
host = "localhost"
port = 5432

[app]
name = "My App"
debug = true
```

**UCL (very similar):**
```ucl
[database]
host = "localhost"
port = 5432

[app]
name = "My App"
debug = true
```

The main differences from TOML:
- UCL supports expressions and variable references
- UCL uses different comment syntax (`//` and `/* */` instead of `#`)
- UCL has built-in environment variable support
- UCL supports type conversion suffixes