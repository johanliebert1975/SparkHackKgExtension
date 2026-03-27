"""Main entry point — orchestrates calculator operations."""
from calculator import Calculator
from operations import AdvancedOps
from logger import Logger
from config import Config

def main():
    """Initialize calculator and run demo operations."""
    logger = Logger(Config.LOG_LEVEL)
    logger.info("Calculator app starting...")
    
    calc = Calculator(logger)
    adv_ops = AdvancedOps(calc)
    
    # Basic operations
    calc.add(10, 5)
    calc.subtract(10, 3)
    
    # Advanced operations
    adv_ops.sqrt_safe(16)
    adv_ops.power_safe(2, 3)
    
    logger.info("Calculator app finished.")

if __name__ == "__main__":
    main()
