"""Logging utility with timestamp support — tracks all calculator operations."""
import sys
from datetime import datetime
from config import Config

class Logger:
    """Logger with timestamp support for operation tracking."""
    
    def __init__(self, level: str = "INFO"):
        """Initialize logger with given level."""
        self.level = level
    
    def _format_message(self, message: str) -> str:
        """Format message with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return f"[{timestamp}] {message}"
    
    def info(self, message: str):
        """Log info-level message with timestamp."""
        if self.level in ['INFO', 'DEBUG']:
            print(f"[INFO] {self._format_message(message)}", file=sys.stdout)
    
    def debug(self, message: str):
        """Log debug-level message with timestamp."""
        if self.level == 'DEBUG':
            print(f"[DEBUG] {self._format_message(message)}", file=sys.stdout)
    
    def warning(self, message: str):
        """Log warning-level message with timestamp."""
        if self.level in ['INFO', 'WARNING', 'DEBUG']:
            print(f"[WARNING] {self._format_message(message)}", file=sys.stderr)
    
    def error(self, message: str):
        """Log error message with timestamp."""
        print(f"[ERROR] {self._format_message(message)}", file=sys.stderr)
