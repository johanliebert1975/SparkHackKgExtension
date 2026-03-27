"""Core calculator class — basic arithmetic operations with enhanced validation."""
from logger import Logger
from validator import validate_number

class Calculator:
    """Performs basic arithmetic operations with comprehensive validation and error handling."""
    
    def __init__(self, logger: Logger) -> None:
        """Initialize calculator with logger dependency for operation tracking."""
        self.logger = logger
    
    def add(self, a: float, b: float) -> float:
        """
        Add two numbers with validation and logging.
        
        Args:
            a: First number to add
            b: Second number to add
            
        Returns:
            Sum of a and b
        """
        validate_number(a)
        validate_number(b)
        result = a + b
        self.logger.info(f"add({a}, {b}) = {result}")
        return result
    
    def subtract(self, a: float, b: float) -> float:
        """
        Subtract b from a with validation.
        
        Args:
            a: Minuend (number to subtract from)
            b: Subtrahend (number to subtract)
            
        Returns:
            Difference (a - b)
        """
        validate_number(a)
        validate_number(b)
        result = a - b
        self.logger.info(f"subtract({a}, {b}) = {result}")
        return result
    
    def multiply(self, a: float, b: float) -> float:
        """
        Multiply two numbers with validation and logging.
        
        Args:
            a: First multiplicand
            b: Second multiplicand
            
        Returns:
            Product of a and b
        """
        validate_number(a)
        validate_number(b)
        result = a * b
        self.logger.info(f"multiply({a}, {b}) = {result}")
        return result
    
    def divide(self, a: float, b: float) -> float:
        """
        Divide a by b with zero-check and validation.
        
        Args:
            a: Dividend (numerator)
            b: Divisor (denominator)
            
        Returns:
            Quotient (a / b)
            
        Raises:
            ZeroDivisionError: If b is zero
        """
        validate_number(a)
        validate_number(b)
        if b == 0:
            raise ZeroDivisionError("Cannot divide by zero")
        result = a / b
        self.logger.info(f"divide({a}, {b}) = {result}")
        return result
