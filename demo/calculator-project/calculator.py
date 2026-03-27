"""Core calculator class — basic arithmetic operations."""
from logger import Logger
from validator import validate_number

class Calculator:
    """Performs basic arithmetic operations with validation."""
    
    def __init__(self, logger: Logger):
        """Initialize calculator with logger dependency."""
        self.logger = logger
    
    def add(self, a: float, b: float) -> float:
        """Add two numbers and log result."""
        validate_number(a)
        validate_number(b)
        result = a + b
        self.logger.info(f"add({a}, {b}) = {result}")
        return result
    
    def subtract(self, a: float, b: float) -> float:
        """Subtract b from a."""
        validate_number(a)
        validate_number(b)
        result = a - b
        self.logger.info(f"subtract({a}, {b}) = {result}")
        return result
    
    def multiply(self, a: float, b: float) -> float:
        """Multiply two numbers."""
        validate_number(a)
        validate_number(b)
        result = a * b
        self.logger.info(f"multiply({a}, {b}) = {result}")
        return result
