"""Input validation utilities."""
import math

def validate_number(value):
    """Ensure value is a valid number for operations."""
    if not isinstance(value, (int, float)):
        raise TypeError(f"Expected number, got {type(value)}")
    if math.isnan(value) or math.isinf(value):
        raise ValueError(f"Invalid number: {value}")
