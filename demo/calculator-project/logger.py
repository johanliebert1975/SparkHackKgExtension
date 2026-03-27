"""Logging utility — tracks all calculator operations."""
import sys
from config import Config

class Logger:
    """Simple logger for tracking operations."""
    
    def __init__(self, level: str = "INFO"):
        """Initialize logger with given level."""
        self.level = level
    
    def info(self, message: str):
        """Log info-level message."""
        if self.level in ['INFO', 'DEBUG']:
            print(f"[INFO] {message}", file=sys.stdout)
    
    def debug(self, message: str):
        """Log debug-level message."""
        if self.level == 'DEBUG':
            print(f"[DEBUG] {message}", file=sys.stdout)
    
    def error(self, message: str):
        """Log error message."""
        print(f"[ERROR] {message}", file=sys.stderr)
