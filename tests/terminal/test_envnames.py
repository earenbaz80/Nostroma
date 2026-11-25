"""nostroma_control/envnames.py: the Python twin of apps/host/server/env-compat.mjs.

The product is Nostroma, the engine still reads NOSTROMA_*, and a script made before the rename must keep working.
"""
import unittest

from nostroma_control import envnames


class EnvVarTest(unittest.TestCase):
    def test_the_new_name_wins(self):
        self.assertEqual(envnames.env_var("ADAPT_FETCH", {"NOSTROMA_ADAPT_FETCH": "8", "NOSTROMA_ADAPT_FETCH": "2"}), "8")

    def test_the_old_name_is_still_read(self):
        self.assertEqual(envnames.env_var("ADAPT_FETCH", {"NOSTROMA_ADAPT_FETCH": "2"}), "2")

    def test_neither_name_is_none(self):
        self.assertIsNone(envnames.env_var("ADAPT_FETCH", {}))

    def test_an_empty_value_counts_as_set(self):
        self.assertEqual(envnames.env_var("ADAPT_FETCH", {"NOSTROMA_ADAPT_FETCH": ""}), "")
        self.assertTrue(envnames.has_env_var("ADAPT_FETCH", {"NOSTROMA_ADAPT_FETCH": ""}))
        self.assertFalse(envnames.has_env_var("ADAPT_FETCH", {}))


class SetEnvVarsTest(unittest.TestCase):
    def test_one_value_under_both_names(self):
        target = {}
        envnames.set_env_vars(target, {"ADAPT_FETCH": "8"})
        self.assertEqual(target, {"NOSTROMA_ADAPT_FETCH": "8", "NOSTROMA_ADAPT_FETCH": "8"})


class ChildEnvTest(unittest.TestCase):
    def test_a_new_name_reaches_an_old_reader(self):
        self.assertEqual(envnames.child_env({"NOSTROMA_ADAPT_FETCH": "8"})["NOSTROMA_ADAPT_FETCH"], "8")

    def test_an_old_name_reaches_a_new_reader(self):
        self.assertEqual(envnames.child_env({"NOSTROMA_ADAPT_FETCH": "8"})["NOSTROMA_ADAPT_FETCH"], "8")

    def test_the_new_name_wins_when_both_are_set(self):
        # the engine reads only NOSTROMA_: it must not read a value the Terminal and the app ignore
        for values in ({"NOSTROMA_ADAPT_FETCH": "8", "NOSTROMA_ADAPT_FETCH": "2"},
                       {"NOSTROMA_ADAPT_FETCH": "2", "NOSTROMA_ADAPT_FETCH": "8"}):
            env = envnames.child_env(values)
            self.assertEqual((env["NOSTROMA_ADAPT_FETCH"], env["NOSTROMA_ADAPT_FETCH"]), ("8", "8"))

    def test_nothing_set_adds_nothing(self):
        self.assertEqual(envnames.child_env({"PATH": "/bin"}), {"PATH": "/bin"})

    def test_this_process_is_not_changed(self):
        source = {"NOSTROMA_ADAPT_FETCH": "8"}
        envnames.child_env(source)
        self.assertEqual(source, {"NOSTROMA_ADAPT_FETCH": "8"})


class AliasOldNamesTest(unittest.TestCase):
    def test_this_process_gets_both(self):
        env = {"NOSTROMA_TUNE_DIR": "/t"}
        envnames.alias_old_names(env)
        self.assertEqual(env, {"NOSTROMA_TUNE_DIR": "/t", "NOSTROMA_TUNE_DIR": "/t"})

    def test_a_second_call_changes_nothing(self):
        env = {"NOSTROMA_TUNE_DIR": "/t"}
        envnames.alias_old_names(env)
        before = dict(env)
        envnames.alias_old_names(env)
        self.assertEqual(env, before)


class GetTest(unittest.TestCase):
    def test_the_new_name_wins(self):
        self.assertEqual(envnames.get("NOSTROMA_TUNE_DIR", env={"NOSTROMA_TUNE_DIR": "/new", "NOSTROMA_TUNE_DIR": "/old"}), "/new")

    def test_the_old_name_is_read_and_named(self):
        import io
        import contextlib
        envnames._warned.clear()
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            value = envnames.get("NOSTROMA_TUNE_DIR", env={"NOSTROMA_TUNE_DIR": "/old"})
        self.assertEqual(value, "/old")
        self.assertIn("NOSTROMA_TUNE_DIR", err.getvalue())

    def test_the_default_when_neither_is_set(self):
        self.assertEqual(envnames.get("NOSTROMA_TUNE_DIR", "fallback", env={}), "fallback")


class QuietCrashEnvTest(unittest.TestCase):
    def test_a_child_gets_both_names(self):
        from nostroma_control.childenv import quiet_crash_env
        env = quiet_crash_env({"NOSTROMA_ARENA_PIN_GIB": "4"})
        self.assertEqual(env["NOSTROMA_ARENA_PIN_GIB"], "4")
        self.assertEqual(env["GGML_NO_BACKTRACE"], "1")

    def test_nothing_set_still_only_adds_the_backtrace_switch(self):
        from nostroma_control.childenv import quiet_crash_env
        self.assertEqual(quiet_crash_env({"PATH": "/bin"}), {"PATH": "/bin", "GGML_NO_BACKTRACE": "1"})


if __name__ == "__main__":
    unittest.main()
