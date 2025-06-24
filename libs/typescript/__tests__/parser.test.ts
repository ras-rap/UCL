import {
  UCLParser,
  parseUclFile,
  parseUclString,
  UCLError,
  UCLSyntaxError,
  UCLReferenceError,
  UCLTypeError,
} from "../src/index"; // Adjust path as needed
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { expect, beforeAll, afterAll, describe, it } from "bun:test"; // Bun's testing utilities

let tempDir: string;

beforeAll(() => {
  // Set up environment variables for testing
  process.env.UCL_APP_ENV = "production";
  process.env.UCL_API_SECRET_KEY = "secret123";
  process.env.UCL_HOSTNAME = "test-host";

  tempDir = mkdtempSync("ucl-test-");
});

afterAll(() => {
  // Clean up environment variables
  delete process.env.UCL_APP_ENV;
  delete process.env.UCL_API_SECRET_KEY;
  delete process.env.UCL_HOSTNAME;

  // Clean up temporary directory
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("UCLParser Basic Functionality", () => {
  it("should parse basic key-value pairs", () => {
    const content = `
        [Application]
        name = "Test App"
        version = "1.0.0"
        `;
    const result = parseUclString(content);
    expect(result).toEqual({
      Application: { name: "Test App", version: "1.0.0" },
    });
  });

  it("should remove comments", () => {
    const content = `
        // Single line comment
        [Section]
        key1 = "value1" // Inline comment
        /* Multi-line
           comment */
        key2 = "value2"
        `;
    const result = parseUclString(content);
    expect(result).toEqual({ Section: { key1: "value1", key2: "value2" } });
  });

  it("should parse various data types", () => {
    const content = `
        [Types]
        integer_val = 42
        float_val = 3.14159
        negative_val = -10
        string_double = "Hello World"
        string_single = 'Another string'
        bool_true = true
        bool_false = FALSE
        null_val = null
        array_val = [1, 2, "three", true]
        json_obj = {"key": "value", "number": 123}
        `;
    const result = parseUclString(content);
    const typesSection = result.Types;
    expect((typesSection as Record<string, unknown>).integer_val).toBe(42);
    expect((typesSection as Record<string, unknown>).float_val).toBe(3.14159);
    expect((typesSection as Record<string, unknown>).negative_val).toBe(-10);
    expect((typesSection as Record<string, unknown>).string_double).toBe("Hello World");
    expect((typesSection as Record<string, unknown>).string_single).toBe("Another string");
    expect((typesSection as Record<string, unknown>).bool_true).toBe(true);
    expect((typesSection as Record<string, unknown>).bool_false).toBe(false);
    expect((typesSection as Record<string, unknown>).null_val).toBeNull();
    expect((typesSection as Record<string, unknown>).array_val).toEqual([1, 2, "three", true]);
    expect((typesSection as Record<string, unknown>).json_obj).toEqual({ key: "value", number: 123 });
  });

  it("should handle escape sequences in strings", () => {
    const content = `
        [Strings]
        newline = "Line1\\nLine2"
        tab = "Item1\\tItem2"
        quote = "He said, \\"Hello!\\""
        backslash = "Path\\\\to\\\\file"
        carriage_return = "Line1\\rLine2"
        `;
    const result = parseUclString(content);
    const strings = result.Strings as Record<string, unknown>;
    expect(strings.newline).toBe("Line1\nLine2");
    expect(strings.tab).toBe("Item1\tItem2");
    expect(strings.quote).toBe('He said, "Hello!"');
    expect(strings.backslash).toBe("Path\\to\\file");
    expect(strings.carriage_return).toBe("Line1\rLine2");
  });

  it("should handle nested sections", () => {
    const content = `
        [Level1]
        key1 = "value1"

        [Level1.Level2]
        key2 = "value2"

        [Level1.Level2.Level3]
        key3 = "value3"
        `;
    const result = parseUclString(content);
    expect((result.Level1 as Record<string, any>).key1).toBe("value1");
    expect((result.Level1 as Record<string, any>).Level2.key2).toBe("value2");
    expect(((result.Level1 as Record<string, any>).Level2 as Record<string, any>).Level3.key3).toBe("value3");
  });

  it("should handle arrays including nested arrays", () => {
    const content = `
        [Arrays]
        simple = [1, 2, 3]
        mixed = [1, "two", true, null]
        nested = [[1, 2], ["a", "b"]]
        complex = [
            ["admin", ["create", "read", "update", "delete"]],
            ["user", ["read"]]
        ]
        `;
    const result = parseUclString(content);
    const arrays = result.Arrays as Record<string, unknown>;
    expect(arrays.simple).toEqual([1, 2, 3]);
    expect(arrays.mixed).toEqual([1, "two", true, null]);
    expect(arrays.nested).toEqual([[1, 2], ["a", "b"]]);
    expect(arrays.complex).toEqual([
      ["admin", ["create", "read", "update", "delete"]],
      ["user", ["read"]],
    ]);
  });

  it("should perform arithmetic operations", () => {
    const content = `
        [Math]
        a = 10
        b = 3
        sum = a + b
        diff = a - b
        product = a * b
        quotient = a / b
        remainder = a % b
        complex = (5 + 3) * 2 / (10 - 6) % 3
        `;
    const result = parseUclString(content);
    const mathSection = result.Math;
    expect((mathSection as Record<string, unknown>).sum).toBe(13);
    expect((mathSection as Record<string, unknown>).diff).toBe(7);
    expect((mathSection as Record<string, unknown>).product).toBe(30);
    expect((mathSection as Record<string, unknown>).quotient).toBeCloseTo(3.333333333333333);
    expect((mathSection as Record<string, unknown>).remainder).toBe(1);
    expect((mathSection as Record<string, unknown>).complex).toBe(1); // (5 + 3) * 2 / (10 - 6) % 3 = 8 * 2 / 4 % 3 = 16 / 4 % 3 = 4 % 3 = 1
  });

  it("should perform string concatenation", () => {
    const content = `
        [Strings]
        first = "Hello"
        second = "World"
        greeting = first + ", " + second + "!"
        with_number = "Version " + 2.0
        `;
    const result = parseUclString(content);
    const strings = result.Strings;
    expect((strings as Record<string, unknown>).greeting).toBe("Hello, World!");
    expect((strings as Record<string, unknown>).with_number).toBe("Version 2"); // Note: JS Number(2.0) is just 2, not "2.0" unless forced
  });

  it("should resolve variable references", () => {
    const content = `
        [Config]
        base_port = 8000
        api_port = base_port + 80

        [Database]
        host = "localhost"
        connection = "Host=" + host
        `;
    const result = parseUclString(content);
    expect((result.Config as Record<string, unknown>).api_port).toBe(8080);
    expect((result.Database as Record<string, unknown>).connection).toBe("Host=localhost");
  });

  it("should resolve environment variables", () => {
    const content = `
        [Runtime]
        env = $ENV{UCL_APP_ENV}
        secret = $ENV{UCL_API_SECRET_KEY}
        hostname = $ENV{UCL_HOSTNAME}
        missing = $ENV{NONEXISTENT_VAR}
        `;
    const result = parseUclString(content);
    const runtime = result.Runtime;
    expect((runtime as Record<string, unknown>).env).toBe("production");
    expect((runtime as Record<string, unknown>).secret).toBe("secret123");
    expect((runtime as Record<string, unknown>).hostname).toBe("test-host");
    expect((runtime as Record<string, unknown>).missing).toBeNull();
  });

  it("should perform explicit type conversions", () => {
    const content = `
        [Conversions]
        str_num = "123"
        str_float = "3.14"
        str_bool_true = "yes"
        str_bool_false = "no"
        num_bool_zero = 0
        num_bool_nonzero = 42

        int_val = str_num.int
        float_val = str_float.float
        bool_val_true = str_bool_true.bool
        bool_val_false = str_bool_false.bool
        bool_from_zero = num_bool_zero.bool
        bool_from_nonzero = num_bool_nonzero.bool
        string_from_num = 123.string
        string_from_bool = true.string
        `;
    const result = parseUclString(content);
    const conv = result.Conversions;
    expect((conv as Record<string, unknown>).int_val).toBe(123);
    expect((conv as Record<string, unknown>).float_val).toBe(3.14);
    expect((conv as Record<string, unknown>).bool_val_true).toBe(true);
    expect((conv as Record<string, unknown>).bool_val_false).toBe(false);
    expect((conv as Record<string, unknown>).bool_from_zero).toBe(false);
    expect((conv as Record<string, unknown>).bool_from_nonzero).toBe(true);
    expect((conv as Record<string, unknown>).string_from_num).toBe("123");
    expect((conv as Record<string, unknown>).string_from_bool).toBe("true");
  });

  it("should apply defaults section", () => {
    const content = `
        [Config]
        existing_key = "existing_value"
        null_key = null

        [Defaults]
        Config.existing_key = "default_value"
        Config.null_key = "default_for_null"
        Config.new_key = "new_default_value"
        NewSection.new_key = "another_default"
        `;
    const result = parseUclString(content);
    expect((result.Config as Record<string, unknown>).existing_key).toBe("existing_value");
    expect((result.Config as Record<string, unknown>).null_key).toBe("default_for_null");
    expect((result.Config as Record<string, unknown>).new_key).toBe("new_default_value");
    expect((result.NewSection as Record<string, unknown>).new_key).toBe("another_default");
  });

  it("should handle section redefinition", () => {
    const content = `
        [Section]
        key1 = "value1"
        key2 = "original"

        [Section]
        key2 = "redefined"
        key3 = "value3"
        `;
    const result = parseUclString(content);
    const section = result.Section as Record<string, unknown>;
    expect(section.key1).toBe("value1");
    expect(section.key2).toBe("redefined");
    expect(section.key3).toBe("value3");
  });

  it("should handle complex references with array/object access", () => {
    const content = `
        [Data]
        users = [
            {"name": "Alice", "id": 1},
            {"name": "Bob", "id": 2}
        ]
        matrix = [["a", "b"], ["c", "d"]]

        [References]
        first_user_name = Data.users[0]["name"]
        matrix_element = Data.matrix[1][0]
        `;
    const result = parseUclString(content);
    const refs = result.References;
    expect((refs as Record<string, unknown>).first_user_name).toBe("Alice");
    expect((refs as Record<string, unknown>).matrix_element).toBe("c");
  });

  it("should parse multi-line JSON objects", () => {
    const content = `
        [Config]
        complex_obj = {
            "database": {
                "host": "localhost",
                "port": 5432,
                "credentials": {
                    "username": "admin",
                    "password": "secret"
                }
            },
            "features": ["auth", "logging", "metrics"]
        }
        `;
    const result = parseUclString(content);
    const obj = (result.Config as Record<string, any>).complex_obj;
    expect(obj.database.host).toBe("localhost");
    expect(obj.database.port).toBe(5432);
    expect(obj.database.credentials.username).toBe("admin");
    expect(obj.features).toEqual(["auth", "logging", "metrics"]);
  });
});

describe("UCLParser Error Handling", () => {
  it("should throw UCLSyntaxError for invalid syntax", () => {
    expect(() => parseUclString("[Test]\ninvalid syntax without equals")).toThrow(
      UCLSyntaxError,
    );
  });

  it("should throw UCLTypeError for invalid type conversion", () => {
    expect(() => parseUclString("[Test]\nval = \"abc\".int")).toThrow(UCLTypeError);
  });

  it("should throw UCLReferenceError for unresolvable reference", () => {
    expect(() => parseUclString("[Test]\nval = nonexistent.key")).toThrow(
      UCLReferenceError,
    );
  });

  it("should throw UCLTypeError for division by zero", () => {
    expect(() => parseUclString("[Test]\nval = 10 / 0")).toThrow(UCLTypeError);
  });

  it("should throw UCLTypeError for modulo by zero", () => {
    expect(() => parseUclString("[Test]\nval = 10 % 0")).toThrow(UCLTypeError);
  });

  it("should throw UCLSyntaxError for mismatched parentheses in expression", () => {
    expect(() => parseUclString("[Test]\nval = (10 + 5")).toThrow(UCLSyntaxError);
  });
});

describe("UCLParser Includes", () => {
  it("should process include files", () => {
    const subContent = `
        [Included]
        key = "included_value"
        `;
    const subFilePath = join(tempDir, "sub.ucl");
    writeFileSync(subFilePath, subContent);

    const mainContent = `
        [Main]
        key = "main_value"
        include "sub.ucl"
        [After]
        key = "after_include"
        `;
    const mainFilePath = join(tempDir, "main.ucl");
    writeFileSync(mainFilePath, mainContent);

    const result = parseUclFile(mainFilePath);
    expect((result.Main as Record<string, unknown>).key).toBe("main_value");
    expect((result.Included as Record<string, unknown>).key).toBe("included_value");
    expect((result.After as Record<string, unknown>).key).toBe("after_include");
  });

  it("should throw UCLError if included file not found", () => {
    const mainContent = `include "non_existent.ucl"`;
    const mainFilePath = join(tempDir, "main_missing_include.ucl");
    writeFileSync(mainFilePath, mainContent);
    expect(() => parseUclFile(mainFilePath)).toThrow(UCLError);
  });
});

describe("UCLParser Edge Cases", () => {
  it("should parse an empty file", () => {
    expect(parseUclString("")).toEqual({});
  });

  it("should parse a file with only comments", () => {
    const content = `
        // Only comments
        /* Multi-line
           comment only */
        `;
    expect(parseUclString(content)).toEqual({});
  });

  it("should handle whitespace correctly", () => {
    const content = `
        [  Section  ]
        key1   =   "value1"
        key2=   "value2"
        key3 ="value3"
        `;
    const result = parseUclString(content);
    const section = result.Section as Record<string, unknown>;
    expect(section.key1).toBe("value1");
    expect(section.key2).toBe("value2");
    expect((section as Record<string, unknown>).key3).toBe("value3");
  });
});

describe("UCLParser Comprehensive Example", () => {
  it("should parse a comprehensive configuration example", () => {
    const content = `
        [Application]
        name = "UCL Demo App"
        version = "1.0.0-beta"
        log_level = "DEBUG"

        [Settings.Numerical]
        max_retries = 5
        timeout_seconds = 120.5

        [Features]
        enable_telemetry = true
        use_beta_features = FALSE

        [Users]
        admin_emails = ["admin@example.com", "support@example.com"]

        [Calculations.Numeric]
        num1 = 7
        num2 = 4
        sum = num1 + num2
        product = num1 * num2

        [Concatenation.Text]
        first_name = "John"
        last_name = "Doe"
        full_greeting = "Welcome, " + first_name + " " + last_name + "!"

        [TypeConversion]
        string_rate = "2.75"
        shipping_cost_str = "10"
        converted_rate_float = string_rate.float
        converted_cost_int = shipping_cost_str.int

        [Defaults]
        Application.new_setting = "Default Value"
        `;

    const result = parseUclString(content);

    expect((result.Application as Record<string, unknown>).name).toBe("UCL Demo App");
    expect((result.Application as Record<string, unknown>).version).toBe("1.0.0-beta");
    expect((result.Application as Record<string, unknown>).log_level).toBe("DEBUG");

    expect((result.Settings as Record<string, any>).Numerical.max_retries).toBe(5);
    expect((result.Settings as Record<string, any>).Numerical.timeout_seconds).toBe(120.5);

    expect((result.Features as Record<string, unknown>).enable_telemetry).toBe(true);
    expect((result.Features as Record<string, unknown>).use_beta_features).toBe(false);

    expect((result.Users as any).admin_emails).toEqual([
      "admin@example.com",
      "support@example.com",
    ]);

    expect((result.Calculations as Record<string, any>).Numeric.sum).toBe(11);
    expect((result.Calculations as Record<string, any>).Numeric.product).toBe(28);

    expect((result.Concatenation as Record<string, any>)?.Text.full_greeting).toBe("Welcome, John Doe!");

    expect((result.TypeConversion as Record<string, unknown>)?.converted_rate_float).toBe(2.75);
    expect((result.TypeConversion as Record<string, unknown>)?.converted_cost_int).toBe(10);

    expect((result.Application as Record<string, unknown>)?.new_setting).toBe("Default Value");
  });
});