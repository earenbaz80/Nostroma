"""The environment variables moved from ``STRATA_*`` to ``NOSTROMA_*``.

This is the Python twin of ``apps/host/server/env-compat.mjs``, and it keeps the same five names so a reader of either
file sees the same contract. The new name wins when both are set; the old one is still read, so a launcher, a preset or
a script made before the rename keeps working; and a child gets both spellings, so the engine (which still reads
``STRATA_*``) sees a setting that was written with the new name.

Nothing is added for a name that is not set, so a machine that sets neither gets the environment it had before.
"""
from __future__ import annotations

import os
import sys

NEW = "NOSTROMA_"
OLD = "STRATA_"

_warned: set[str] = set()


def env_var(name: str, env=None) -> str | None:
    """The value of ``NOSTROMA_<name>``, or the older ``STRATA_<name>`` when only that one is set."""
    source = os.environ if env is None else env
    value = source.get(NEW + name)
    return source.get(OLD + name) if value is None else value


def has_env_var(name: str, env=None) -> bool:
    """True when either name is set to anything."""
    return env_var(name, env) is not None


def set_env_vars(target: dict, values: dict) -> dict:
    """One value under both names, for a child that may still read the old name."""
    for name, value in values.items():
        target[NEW + name] = value
        target[OLD + name] = value
    return target


def child_env(values=None) -> dict:
    """An environment for a child process with both spellings of every name it sets.

    The engine and the older Python code read ``STRATA_*``; the host reads ``NOSTROMA_*``. With this they see the same
    settings. When both spellings are set, the new one wins in both, so the engine cannot read a value the Terminal and
    the app ignore: that is the precedence the release notes promise.
    """
    source = os.environ if values is None else values
    out = dict(source)
    for name, value in source.items():
        if name.startswith(NEW):
            out[OLD + name[len(NEW):]] = value            # the new name wins, whatever order the two are seen in
        elif name.startswith(OLD):
            out.setdefault(NEW + name[len(OLD):], value)
    return out


def alias_old_names(env: dict | None = None) -> dict:
    """Fill in the missing name for every variable in this process, once at startup, so anything inherited carries both."""
    target = os.environ if env is None else env
    target.update(child_env(target))
    return target


def get(name: str, default: str | None = None, env=None) -> str | None:
    """A setting by its Nostroma name, falling back to the name it had before, and saying the new name once.

    ``name`` is the full name here (``NOSTROMA_ADAPT_FETCH``), because this is what a renamed call site passes.
    """
    source = os.environ if env is None else env
    if name in source:
        return source[name]
    twin = OLD + name[len(NEW):] if name.startswith(NEW) else NEW + name[len(OLD):]
    if twin in source:
        new = NEW + twin[len(OLD):] if twin.startswith(OLD) else twin
        if twin not in _warned:
            _warned.add(twin)
            sys.stderr.write("%s is the old name of %s; it still works. Set %s instead.\n" % (twin, new, new))
        return source[twin]
    return default
