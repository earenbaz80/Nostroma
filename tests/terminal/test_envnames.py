"""nostroma_control/envnames.py: the Python twin of apps/host/server/env-compat.mjs.

The product has one environment prefix, ``NOSTROMA_*``.
"""
import unittest

from nostroma_control import envnames


class EnvVarTest(unittest.TestCase):
    def test_the_value_is_read(self):
        self.assertEqual(envnames.env_var("ADAPT_FETCH", {"NOSTROMA_ADAPT_FETCH": "8"}), "8")

    def test_an_unset_name_is_none(self):
        self.assertIsNone(envnames.env_var("ADAPT_FETCH", {}))

    def test_an_empty_value_counts_as_set(self):
        self.assertEqual(envnames.env_var("ADAPT_FETCH", {"NOSTROMA_ADAPT_FETCH": ""}), "")
        self.assertTrue(envnames.has_env_var("ADAPT_FETCH", {"NOSTROMA_ADAPT_FETCH": ""}))
        self.assertFalse(envnames.has_env_var("ADAPT_FETCH", {}))


class SetEnvVarsTest(unittest.TestCase):
    def test_one_value_under_the_nostroma_name(self):
        target = {}
        envnames.set_env_vars(target, {"ADAPT_FETCH": "8"})
        self.assertEqual(target, {"NOSTROMA_ADAPT_FETCH": "8"})


class ChildEnvTest(unittest.TestCase):
    def test_the_environment_is_copied_unchanged(self):
        source = {"NOSTROMA_ADAPT_FETCH": "8", "PATH": "/bin"}
        self.assertEqual(envnames.child_env(source), source)

    def test_nothing_set_adds_nothing(self):
        self.assertEqual(envnames.child_env({"PATH": "/bin"}), {"PATH": "/bin"})

    def test_this_process_is_not_changed(self):
        source = {"NOSTROMA_ADAPT_FETCH": "8"}
        envnames.child_env(source)
        self.assertEqual(source, {"NOSTROMA_ADAPT_FETCH": "8"})


class GetTest(unittest.TestCase):
    def test_the_value_is_read(self):
        self.assertEqual(envnames.get("NOSTROMA_TUNE_DIR", env={"NOSTROMA_TUNE_DIR": "/new"}), "/new")

    def test_the_default_when_it_is_not_set(self):
        self.assertEqual(envnames.get("NOSTROMA_TUNE_DIR", "fallback", env={}), "fallback")


class QuietCrashEnvTest(unittest.TestCase):
    def test_a_child_keeps_the_nostroma_settings(self):
        from nostroma_control.childenv import quiet_crash_env
        env = quiet_crash_env({"NOSTROMA_ARENA_PIN_GIB": "4"})
        self.assertEqual(env["NOSTROMA_ARENA_PIN_GIB"], "4")
        self.assertEqual(env["GGML_NO_BACKTRACE"], "1")

    def test_nothing_set_still_only_adds_the_backtrace_switch(self):
        from nostroma_control.childenv import quiet_crash_env
        self.assertEqual(quiet_crash_env({"PATH": "/bin"}), {"PATH": "/bin", "GGML_NO_BACKTRACE": "1"})


if __name__ == "__main__":
    unittest.main()
