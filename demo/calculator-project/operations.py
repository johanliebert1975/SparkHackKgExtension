"""Advanced mathematical operations using Calculator."""
from calculator import Calculator
from validator import validate_number
import math

class AdvancedOps:
    """Wrapper for advanced operations combining Calculator with math module."""
    
    def __init__(self, calc: Calculator):
        """Initialize with a Calculator instance."""
        self.calc = calc
    
    def sqrt_safe(self, x: float) -> float:
        """Calculate square root safely."""
        validate_number(x)
        if x < 0:
            raise ValueError("Cannot compute sqrt of negative number")
        return math.sqrt(x)
    
    def power_safe(self, base: float, exp: float) -> float:
        """Calculate power safely."""
        validate_number(base)
        validate_number(exp)
        return math.pow(base, exp)
    
    def divide_safe(self, a: float, b: float) -> float:
        """Divide with zero-check."""
        validate_number(a)
        validate_number(b)
        if b == 0:
            raise ValueError("Division by zero")
        return a / b
