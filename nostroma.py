"""Nostroma's terminal entry point. ``nostroma.py`` is the file the Control archive ships, so the program lives there.

``python nostroma.py`` (the new name) runs it; ``python nostroma.py`` (the old name, and what the archive carries) runs the same
program directly, with no second copy to drift.
"""

import runpy
import sys
from pathlib import Path

if __name__ == "__main__":
    program = Path(__file__).with_name("nostroma.py")
    sys.argv[0] = str(program)
    runpy.run_path(str(program), run_name="__main__")
