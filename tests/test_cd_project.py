"""Behavior tests for the existing Python syntax analyzer."""

import contextlib
import io
import unittest

from cd_project import SyntaxAnalyzer


class SyntaxAnalyzerTests(unittest.TestCase):
    def analyze(self, source):
        analyzer = SyntaxAnalyzer()
        # analyze() prints its report; assertions use the analyzer's diagnostics.
        with contextlib.redirect_stdout(io.StringIO()):
            analyzer.analyze(source)
        return analyzer.errs

    def test_accepts_valid_indented_python(self):
        source = "count = 2\nif count > 1:\n    print(count)"

        self.assertEqual([], self.analyze(source))

    def test_reports_unindented_block_body(self):
        errors = self.analyze("if True:\nprint('hello')")

        self.assertTrue(any(error["type"] == "IndentationError" for error in errors))

    def test_reports_unclosed_bracket(self):
        errors = self.analyze("values = [1, 2")

        self.assertTrue(any(error["type"] == "Matching Error" for error in errors))

    def test_ignores_comments_and_blank_lines(self):
        source = "# a comment\n\nvalue = 3  # trailing comment\n"

        self.assertEqual([], self.analyze(source))

    def test_each_analysis_starts_with_fresh_state(self):
        analyzer = SyntaxAnalyzer()
        with contextlib.redirect_stdout(io.StringIO()):
            analyzer.analyze("if True:\npass")
            self.assertTrue(analyzer.errs)
            analyzer.analyze("value = 3")

        self.assertEqual([], analyzer.errs)


if __name__ == "__main__":
    unittest.main()
