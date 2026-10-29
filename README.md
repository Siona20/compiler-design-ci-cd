# PyLint-Lite: Python Syntax Analyzer

PyLint-Lite is an educational lexical and syntax analyzer for Python source. It checks constructs such as indentation, block headers, brackets, tokens, and operator sequences, and reports diagnostics with line numbers. The repository includes both a command-line Python analyzer and a browser-based visualizer with a JavaScript implementation of the analyzer.

This is a learning project and is not a replacement for Python's parser or a complete language validator.

## Prerequisites

- Python 3.10 or newer (the Python analyzer and its automated tests use only the standard library).
- A modern browser to use the visualizer.
- Internet access in the browser for the visualizer's Monaco Editor, fonts, and icons, which are loaded from CDNs.

No package installation is required for the Python analyzer or tests.

## Setup and usage

Clone the repository and change into its directory. To start the interactive command-line analyzer:

```sh
python cd_project.py
```

Enter Python source one line at a time. Finish input with Ctrl+D on macOS/Linux or Ctrl+Z, then Enter, on Windows. The analyzer prints a report of detected issues.

To use the browser visualizer, serve the repository directory locally:

```sh
python -m http.server 8000
```

Then open <http://localhost:8000> in a browser and select **Run Analysis**. Serving the files over HTTP allows the browser UI to load its CDN-hosted editor resources.

## Tests

Run the standard-library test suite from the repository root:

```sh
python -m unittest discover -s tests -v
```

The tests cover valid source, invalid indentation, unclosed brackets, comments and blank lines, and resetting analyzer state between calls.

## CI and artifact

GitHub Actions runs the tests on pushes to `main`, pull requests targeting `main`, and manual workflow dispatch. A failed test fails the workflow. After successful tests, the workflow creates and uploads `compiler-design-project.zip` with the README and application source files as a downloadable workflow artifact. It does not deploy the application or publish a release.
