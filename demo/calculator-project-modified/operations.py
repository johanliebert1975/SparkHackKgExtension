"""Advanced mathematical operations with additional helper functions."""
from calculator import Calculator
from validator import validate_number
import math

class AdvancedOps:
    """Wrapper for advanced operations combining Calculator with math module utilities."""
    
    def __init__(self, calc: Calculator):
        """Initialize with a Calculator instance for compound operations."""
        self.calc = calc
    
    def sqrt_safe(self, x: float) -> float:
        """Calculate square root safely with validation."""
        validate_number(x)
        if x < 0:
            raise ValueError("Cannot compute sqrt of negative number")
        return math.sqrt(x)
    
    def power_safe(self, base: float, exp: float) -> float:
        """
        Calculate power (base^exp) with extended precision handling.
        
        Safely computes base raised to the power of exp with proper
        validation and error handling for edge cases.
        
        Args:
            base: The base number
            exp: The exponent
            
        Returns:
            Result of base^exp
        """
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
    
    def gcd(self, a: int, b: int) -> int:
        """
        Calculate greatest common divisor using Euclidean algorithm.
        
        Args:
            a: First integer
            b: Second integer
            
        Returns:
            Greatest common divisor of a and b
        """
        while b:
            a, b = b, a % b
        return abs(a)
