import logging
import sys

from loguru import logger

LOG_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss Z}</green> | "
    "<level>{level}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | {message}"
)


class InterceptHandler(logging.Handler):
    loglevel_mapping = {
        50: "CRITICAL",
        40: "ERROR",
        30: "WARNING",
        20: "INFO",
        10: "DEBUG",
        0: "NOTSET",
    }

    def emit(self, record):
        try:
            level = logger.level(record.levelname).name
        except AttributeError:
            level = self.loglevel_mapping[record.levelno]

        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        log = logger.bind(request_id="app")
        log.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging():
    logger.remove()
    logger.add(sys.stdout, level="INFO", diagnose=True, format=LOG_FORMAT, colorize=True, backtrace=True, enqueue=True)
    logging.root.handlers = [InterceptHandler()]

    for name in [
        *logging.root.manager.loggerDict.keys(),
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "granian",
        "_granian",
        "granian.access",
        "sqlalchemy",
    ]:
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
