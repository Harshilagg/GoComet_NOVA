import logging
import sys

# Configure DocuAI Structured Logger
def setup_logger():
    logger = logging.getLogger("DocuAI")
    logger.setLevel(logging.INFO)
    
    # Prevent duplicate handlers if reloaded
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        # Professional format: [Timestamp] [DocuAI][LEVEL] Message
        formatter = logging.Formatter(
            '[%(asctime)s] [DocuAI][%(levelname)s] %(message)s',
            datefmt='%H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger

logger = setup_logger()
