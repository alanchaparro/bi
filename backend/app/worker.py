import logging
import os
import signal
import time

from app.services.sync_service import SyncService


logger = logging.getLogger(__name__)

SCHEDULER_TICK_INTERVAL_SEC = 60.0


def main() -> None:
    worker_name = os.getenv("SYNC_WORKER_NAME", "sync-worker")
    idle_sleep = float(os.getenv("SYNC_WORKER_IDLE_SLEEP_SECONDS", "1.5"))
    stop = {"flag": False}
    last_scheduler_tick = 0.0

    def _shutdown_handler(signum, _frame):  # type: ignore[no-untyped-def]
        logger.info("sync worker received signal %s, stopping...", signum)
        stop["flag"] = True

    signal.signal(signal.SIGTERM, _shutdown_handler)
    signal.signal(signal.SIGINT, _shutdown_handler)

    logger.info("sync worker started: %s", worker_name)
    try:
        SyncService.worker_bootstrap_cleanup()
    except Exception:
        logger.exception("sync worker bootstrap cleanup failed; will retry on loop")
    while not stop["flag"]:
        now = time.monotonic()
        if now - last_scheduler_tick >= SCHEDULER_TICK_INTERVAL_SEC:
            try:
                SyncService.run_scheduler_tick_service()
                last_scheduler_tick = now
            except Exception:
                logger.exception("scheduler tick error")
        try:
            ran = SyncService.poll_and_run_next(worker_name=worker_name)
        except Exception:
            logger.exception("sync worker loop error")
            ran = False
        if not ran:
            time.sleep(max(0.5, idle_sleep))

    logger.info("sync worker stopped: %s", worker_name)


if __name__ == "__main__":
    main()
