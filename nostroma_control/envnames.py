"""The environment variables are ``NOSTROMA_*``.

This is the Python twin of ``apps/host/server/env-compat.mjs``, and it keeps the same names so a reader of either file
sees the same contract: one prefix, read and written everywhere, and a child process gets the environment it was given.
"""
from __future__ import annotations

import os

NEW = "NOSTROMA_"


def env_var(name: str, env=None) -> str | None:
    """The value of ``NOSTROMA_<name>``."""
    source = os.environ if env is None else env
    return source.get(NEW + name)


def has_env_var(name: str, env=None) -> bool:
    """True when ``NOSTROMA_<name>`` is set to anything."""
    return env_var(name, env) is not None


def set_env_vars(target: dict, values: dict) -> dict:
    """Set one value per name under the Nostroma prefix."""
    for name, value in values.items():
        target[NEW + name] = value
    return target


def child_env(values=None) -> dict:
    """A copy of the environment for a child process."""
    source = os.environ if values is None else values
    return dict(source)


def get(name: str, default: str | None = None, env=None) -> str | None:
    """A setting by its full Nostroma name (``NOSTROMA_ADAPT_FETCH``)."""
    source = os.environ if env is None else env
    return source.get(name, default)
