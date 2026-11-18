"""Green locust logo printed when a load test starts. Disable with LOADTEST_BANNER=0."""

import os
import sys
import time

LOGO = r"""
⠀⣤⡀⠀⠀⠀⠀⠀⠀⣤⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠘⢷⡄⠀⠀⠀⠀⢰⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠈⠻⠆⢀⣀⣀⣈⣁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⢀⣤⣈⠙⢿⣿⣿⣷⠘⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⢹⣿⣿⡇⠘⣿⣿⣿⡆⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⢀⣠⣄⡉⠛⠁⠼⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠀⡄⠀⠀⠀⠀⠀
⠀⣿⣿⡟⢁⠀⠀⠀⠀⠙⠛⠿⡆⠸⣦⠀⠀⠀⠀⠀⢀⠞⠋⣀⡤⡀⠀⠀⠀⠀
⠀⡿⠋⣀⠘⢷⣄⠀⠀⢹⡇⠀⠀⠀⠈⠆⠀⠀⠀⠀⣠⣴⣿⣿⢁⡇⠀⠀⠀⠀
⠀⠀⠀⢹⣷⡌⠻⣦⡀⠀⠙⠀⠀⠀⠀⠀⠀⠀⣠⣾⣿⣿⡿⠁⢸⡇⢸⡆⠀⠀
⠀⠀⠀⠀⢿⣿⣆⠙⢿⣆⠀⠀⠀⠀⠀⠀⣠⣾⣿⣿⣿⠟⠁⠀⣾⡇⢸⣿⡄⠀
⠀⠀⠀⠀⠈⢿⣿⣧⠈⢿⣷⡀⠀⠀⢀⣴⣿⣿⣿⡿⠃⠀⠀⢰⣿⡇⠘⠻⣷⠀
⠀⠀⠀⠀⠀⠀⠻⣿⣷⡀⠻⣿⠂⣠⣿⣿⣿⣿⠟⠀⠀⠀⠀⣼⣿⠃⠀⢀⣿⠀
⠀⠀⠀⠀⠀⠀⠀⠙⢿⣷⡄⠀⣴⣿⣿⣿⠟⠁⠀⠀⠀⠀⢀⣼⠋⠀⠀⠸⡇⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠃⣸⣿⣿⠟⢁⡴⠂⠀⠀⠀⠴⠛⠁⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠋⠀⠀⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
""".strip("\n")

GREEN = "\033[92m"
RESET = "\033[0m"


ROW_DELAY = 0.04  # seconds per row: 15 rows ≈ 0.6 s


def show(subtitle=""):
    if os.getenv("LOADTEST_BANNER", "1") == "0":
        return
    tail = ("\n  " + subtitle if subtitle else "") + "\n"
    if not sys.stdout.isatty() or os.getenv("NO_COLOR"):
        print(LOGO + "\n" + tail, flush=True)  # piped / CI: all at once, no color
        return
    for row in LOGO.splitlines():
        print(GREEN + row + RESET, flush=True)
        time.sleep(ROW_DELAY)
    print(GREEN + tail + RESET, flush=True)
