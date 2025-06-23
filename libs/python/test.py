import unittest
import os
import tempfile
import shutil
from pathlib import Path
from parser import (
    UCLParser, parse_ucl_file, parse_ucl_string,
    UCLError, UCLSyntaxError, UCLReferenceError, UCLTypeError
)


class TestUCLParser(unittest.TestCase):
    """Comprehensive test suite for UCL Parser."""
    
    def setUp(self):
        """Set up test environment."""
        self.parser = UCLParser()
        self.test_dir = Path(__file__).parent / "test_files"
        
        # Set up environment variables for testing
        os.environ['UCL_APP_ENV'] = 'production'
        os.environ['UCL_API_SECRET_KEY'] = 'secret123'
        os.environ['UCL_HOSTNAME'] = 'test-host'
    
    def tearDown(self):
        """Clean up test environment."""
        # Clean up environment variables
        for key in ['UCL_APP_ENV', 'UCL_API_SECRET_KEY', 'UCL_HOSTNAME']:
            if key in os.environ:
                del os.environ[key]
    
    def test_basic_key_value_pairs(self):
        """Test basic key-value pair parsing."""
        content = '''
        [Application]
        name = "Test App"
        version = "1.0.0"
        '''
        
        result = parse_ucl_string(content)
        
        self.assertEqual(result['Application']['name'], "Test App")
        self.assertEqual(result['Application']['version'], "1.0.0")
    
    def test_comments_removal(self):
        """Test comment removal."""
        content = '''
        // Single line comment
        [Section]
        key1 = "value1" // Inline comment
        /* Multi-line
           comment */
        key2 = "value2"
        '''
        
        result = parse_ucl_string(content)
        
        self.assertEqual(result['Section']['key1'], "value1")
        self.assertEqual(result['Section']['key2'], "value2")
    
    def test_data_types(self):
        """Test all supported data types."""
        content = '''
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
        '''
        
        result = parse_ucl_string(content)
        types_section = result['Types']
        
        self.assertEqual(types_section['integer_val'], 42)
        self.assertEqual(types_section['float_val'], 3.14159)
        self.assertEqual(types_section['negative_val'], -10)
        self.assertEqual(types_section['string_double'], "Hello World")
        self.assertEqual(types_section['string_single'], "Another string")
        self.assertTrue(types_section['bool_true'])
        self.assertFalse(types_section['bool_false'])
        self.assertIsNone(types_section['null_val'])
        self.assertEqual(types_section['array_val'], [1, 2, "three", True])
        self.assertEqual(types_section['json_obj'], {"key": "value", "number": 123})
    
    def test_escape_sequences(self):
        """Test string escape sequences."""
        content = '''
        [Strings]
        newline = "Line1\\nLine2"
        tab = "Item1\\tItem2"
        quote = "He said, \\"Hello!\\""
        backslash = "Path\\\\to\\\\file"
        carriage_return = "Line1\\rLine2"
        '''
        
        result = parse_ucl_string(content)
        strings = result['Strings']
        
        self.assertEqual(strings['newline'], "Line1\nLine2")
        self.assertEqual(strings['tab'], "Item1\tItem2")
        self.assertEqual(strings['quote'], 'He said, "Hello!"')
        self.assertEqual(strings['backslash'], "Path\\to\\file")
        self.assertEqual(strings['carriage_return'], "Line1\rLine2")
    
    def test_nested_sections(self):
        """Test nested section parsing."""
        content = '''
        [Level1]
        key1 = "value1"
        
        [Level1.Level2]
        key2 = "value2"
        
        [Level1.Level2.Level3]
        key3 = "value3"
        '''
        
        result = parse_ucl_string(content)
        
        self.assertEqual(result['Level1']['key1'], "value1")
        self.assertEqual(result['Level1']['Level2']['key2'], "value2")
        self.assertEqual(result['Level1']['Level2']['Level3']['key3'], "value3")
    
    def test_arrays(self):
        """Test array parsing including nested arrays."""
        content = '''
        [Arrays]
        simple = [1, 2, 3]
        mixed = [1, "two", true, null]
        nested = [[1, 2], ["a", "b"]]
        complex = [
            ["admin", ["create", "read", "update", "delete"]],
            ["user", ["read"]]
        ]
        '''
        
        result = parse_ucl_string(content)
        arrays = result['Arrays']
        
        self.assertEqual(arrays['simple'], [1, 2, 3])
        self.assertEqual(arrays['mixed'], [1, "two", True, None])
        self.assertEqual(arrays['nested'], [[1, 2], ["a", "b"]])
        self.assertEqual(arrays['complex'], [
            ["admin", ["create", "read", "update", "delete"]],
            ["user", ["read"]]
        ])
    
    def test_arithmetic_operations(self):
        """Test arithmetic operations."""
        content = '''
        [Math]
        a = 10
        b = 3
        sum = a + b
        diff = a - b
        product = a * b
        quotient = a / b
        remainder = a % b
        complex = (5 + 3) * 2 / (10 - 6) % 3
        '''
        
        result = parse_ucl_string(content)
        math_section = result['Math']
        
        self.assertEqual(math_section['sum'], 13)
        self.assertEqual(math_section['diff'], 7)
        self.assertEqual(math_section['product'], 30)
        self.assertAlmostEqual(math_section['quotient'], 3.333333333333333)
        self.assertEqual(math_section['remainder'], 1)
        # (5 + 3) * 2 / (10 - 6) % 3 = 8 * 2 / 4 % 3 = 16 / 4 % 3 = 4 % 3 = 1
        self.assertEqual(math_section['complex'], 1)
    
    def test_string_concatenation(self):
        """Test string concatenation."""
        content = '''
        [Strings]
        first = "Hello"
        second = "World"
        greeting = first + ", " + second + "!"
        with_number = "Version " + 2.0
        '''
        
        result = parse_ucl_string(content)
        strings = result['Strings']
        
        self.assertEqual(strings['greeting'], "Hello, World!")
        self.assertEqual(strings['with_number'], "Version 2.0")
    
    def test_variable_references(self):
        """Test variable references."""
        content = '''
        [Config]
        base_port = 8000
        api_port = base_port + 80
        
        [Database]
        host = "localhost"
        connection = "Host=" + host
        '''
        
        result = parse_ucl_string(content)
        
        self.assertEqual(result['Config']['api_port'], 8080)
        self.assertEqual(result['Database']['connection'], "Host=localhost")
    
    def test_environment_variables(self):
        """Test environment variable resolution."""
        content = '''
        [Runtime]
        env = $ENV{UCL_APP_ENV}
        secret = $ENV{UCL_API_SECRET_KEY}
        hostname = $ENV{UCL_HOSTNAME}
        missing = $ENV{NONEXISTENT_VAR}
        '''
        
        result = parse_ucl_string(content)
        runtime = result['Runtime']
        
        self.assertEqual(runtime['env'], 'production')
        self.assertEqual(runtime['secret'], 'secret123')
        self.assertEqual(runtime['hostname'], 'test-host')
        self.assertIsNone(runtime['missing'])
    
    def test_type_conversions(self):
        """Test explicit type conversions."""
        content = '''
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
        '''
        
        result = parse_ucl_string(content)
        conv = result['Conversions']
        
        self.assertEqual(conv['int_val'], 123)
        self.assertEqual(conv['float_val'], 3.14)
        self.assertTrue(conv['bool_val_true'])
        self.assertFalse(conv['bool_val_false'])
        self.assertFalse(conv['bool_from_zero'])
        self.assertTrue(conv['bool_from_nonzero'])
        self.assertEqual(conv['string_from_num'], "123")
        self.assertEqual(conv['string_from_bool'], "true")
    
    def test_defaults_section(self):
        """Test defaults section functionality."""
        content = '''
        [Config]
        existing_key = "existing_value"
        null_key = null
        
        [Defaults]
        Config.existing_key = "default_value"
        Config.null_key = "default_for_null"
        Config.new_key = "new_default_value"
        NewSection.new_key = "another_default"
        '''
        
        result = parse_ucl_string(content)
        
        # Existing non-null value should not be overridden
        self.assertEqual(result['Config']['existing_key'], "existing_value")
        
        # Null value should be replaced with default
        self.assertEqual(result['Config']['null_key'], "default_for_null")
        
        # New key should be added with default value
        self.assertEqual(result['Config']['new_key'], "new_default_value")
        
        # New section should be created with default
        self.assertEqual(result['NewSection']['new_key'], "another_default")
    
    def test_section_redefinition(self):
        """Test section redefinition behavior."""
        content = '''
        [Section]
        key1 = "value1"
        key2 = "original"
        
        [Section]
        key2 = "redefined"
        key3 = "value3"
        '''
        
        result = parse_ucl_string(content)
        section = result['Section']
        
        self.assertEqual(section['key1'], "value1")
        self.assertEqual(section['key2'], "redefined")
        self.assertEqual(section['key3'], "value3")
    
    def test_case_sensitivity(self):
        """Test case sensitivity rules."""
        content = '''
        [Section]
        myKey = "value1"
        MyKey = "value2"
        bool_true = TRUE
        bool_false = false
        null_val = NULL
        '''
        
        result = parse_ucl_string(content)
        section = result['Section']
        
        # Keys are case-sensitive
        self.assertEqual(section['myKey'], "value1")
        self.assertEqual(section['MyKey'], "value2")
        
        # Boolean and null literals are case-insensitive
        self.assertTrue(section['bool_true'])
        self.assertFalse(section['bool_false'])
        self.assertIsNone(section['null_val'])
    
    def test_complex_references(self):
        """Test complex variable references with array/object access."""
        content = '''
        [Data]
        users = [
            {"name": "Alice", "id": 1},
            {"name": "Bob", "id": 2}
        ]
        matrix = [["a", "b"], ["c", "d"]]
        
        [References]
        first_user_name = Data.users[0]["name"]
        matrix_element = Data.matrix[1][0]
        '''
        
        result = parse_ucl_string(content)
        refs = result['References']
        
        self.assertEqual(refs['first_user_name'], "Alice")
        self.assertEqual(refs['matrix_element'], "c")
    
    def test_multiline_json(self):
        """Test multi-line JSON object parsing."""
        content = '''
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
        '''
        
        result = parse_ucl_string(content)
        obj = result['Config']['complex_obj']
        
        self.assertEqual(obj['database']['host'], "localhost")
        self.assertEqual(obj['database']['port'], 5432)
        self.assertEqual(obj['database']['credentials']['username'], "admin")
        self.assertEqual(obj['features'], ["auth", "logging", "metrics"])
    
    def test_error_handling(self):
        """Test error handling for various invalid inputs."""
        
        # Invalid syntax - line without equals sign should raise error
        with self.assertRaises(UCLSyntaxError):
            parse_ucl_string('[Test]\ninvalid syntax without equals')
        
        # Invalid type conversion
        with self.assertRaises(UCLTypeError):
            parse_ucl_string('[Test]\nval = "abc".int')
        
        # Unresolvable reference
        with self.assertRaises(UCLReferenceError):
            parse_ucl_string('[Test]\nval = nonexistent.key')
    
    def test_includes(self):
        """Test include functionality."""
        # Create temporary files for testing includes
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Create main file
            main_content = '''
            [Main]
            key = "main_value"
            
            include "sub.ucl"
            
            [After]
            key = "after_include"
            '''
            
            # Create included file
            sub_content = '''
            [Included]
            key = "included_value"
            '''
            
            main_file = temp_path / "main.ucl"
            sub_file = temp_path / "sub.ucl"
            
            main_file.write_text(main_content)
            sub_file.write_text(sub_content)
            
            result = parse_ucl_file(main_file)
            
            self.assertEqual(result['Main']['key'], "main_value")
            self.assertEqual(result['Included']['key'], "included_value")
            self.assertEqual(result['After']['key'], "after_include")
    
    def test_comprehensive_example(self):
        """Test a comprehensive example."""
        content = '''
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
        '''
        
        result = parse_ucl_string(content)
        
        # Test basic values
        self.assertEqual(result['Application']['name'], "UCL Demo App")
        self.assertEqual(result['Application']['version'], "1.0.0-beta")
        
        # Test numbers
        self.assertEqual(result['Settings']['Numerical']['max_retries'], 5)
        self.assertEqual(result['Settings']['Numerical']['timeout_seconds'], 120.5)
        
        # Test booleans
        self.assertTrue(result['Features']['enable_telemetry'])
        self.assertFalse(result['Features']['use_beta_features'])
        
        # Test arrays
        self.assertEqual(result['Users']['admin_emails'], 
                       ["admin@example.com", "support@example.com"])
        
        # Test arithmetic
        self.assertEqual(result['Calculations']['Numeric']['sum'], 11)
        self.assertEqual(result['Calculations']['Numeric']['product'], 28)
        
        # Test string concatenation
        self.assertEqual(result['Concatenation']['Text']['full_greeting'], 
                       "Welcome, John Doe!")
        
        # Test type conversions
        self.assertEqual(result['TypeConversion']['converted_rate_float'], 2.75)
        self.assertEqual(result['TypeConversion']['converted_cost_int'], 10)
        
        # Test defaults application
        self.assertEqual(result['Application']['new_setting'], "Default Value")


class TestUCLParserEdgeCases(unittest.TestCase):
    """Test edge cases and error conditions."""
    
    def test_empty_file(self):
        """Test parsing empty file."""
        result = parse_ucl_string("")
        self.assertEqual(result, {})
    
    def test_only_comments(self):
        """Test file with only comments."""
        content = '''
        // Only comments
        /* Multi-line
           comment only */
        '''
        result = parse_ucl_string(content)
        self.assertEqual(result, {})
    
    def test_whitespace_handling(self):
        """Test whitespace handling."""
        content = '''
        
        [  Section  ]
        key1   =   "value1"  
        key2=   "value2"
        key3 ="value3"   
        
        '''
        
        result = parse_ucl_string(content)
        section = result['Section']
        
        self.assertEqual(section['key1'], "value1")
        self.assertEqual(section['key2'], "value2")
        self.assertEqual(section['key3'], "value3")
    
    def test_special_characters_in_strings(self):
        """Test special characters in strings."""
        content = '''
        [Special]
        unicode = "Hello 世界"
        symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        empty = ""
        '''
        
        result = parse_ucl_string(content)
        special = result['Special']
        
        self.assertEqual(special['unicode'], "Hello 世界")
        self.assertEqual(special['symbols'], "!@#$%^&*()_+-=[]{}|;:,.<>?")
        self.assertEqual(special['empty'], "")
    
    def test_large_numbers(self):
        """Test large number handling."""
        content = '''
        [Numbers]
        large_int = 9223372036854775807
        large_float = 1.7976931348623157e+308
        small_float = 2.2250738585072014e-308
        '''
        
        result = parse_ucl_string(content)
        numbers = result['Numbers']
        
        self.assertEqual(numbers['large_int'], 9223372036854775807)
        self.assertEqual(numbers['large_float'], 1.7976931348623157e+308)
        self.assertEqual(numbers['small_float'], 2.2250738585072014e-308)


if __name__ == '__main__':
    unittest.main()