---
title: CLI reports version "1.0"
---

# `turingdb` CLI reports version "1.0", disconnected from the real release version

**What we expected:** `turingdb --version` (or whatever surfaces the CLI's version) to reflect the actual release — currently `1.36` on PyPI/GitHub, versioned correctly there via `setuptools_scm` off git tags (`pyproject.toml`: `dynamic = ["version"]`, written to `python/turingdb/_version.py`).

**What's actually happening:** the `turingdb` console script doesn't run the Python package's version at all — `python/turingdb/__init__.py`'s `main()` uses `os.execv` to replace the process with the compiled C++ executable shipped inside the wheel. That executable's own version string is hardcoded in `tools/turingdb/TuringDBTool.cpp:47`:

```cpp
argparse::ArgumentParser rootParser("turingdb", "1.0", argparse::default_arguments::help);
```

`"1.0"` is a literal, never bumped alongside releases. `CMakeLists.txt` has no `project(turingdb VERSION ...)` declaration at all, so there's no single source of truth wiring the C++ build's version to the git tag / PyPI version. There's a separate `-v`/`--version` action registered further down that prints `TuringDBCommitInfo()` (commit hash + build timestamp) instead — but the `"1.0"` literal passed to the parser constructor is itself stale metadata that's still present and reachable depending on how `argparse.hpp` surfaces it (e.g. in help/usage output).

**Confidence:** high that `"1.0"` is dead/stale hardcoded metadata — confirmed directly from `main`'s source (`tools/turingdb/TuringDBTool.cpp`). No PyPI release named `1.0` has ever been published (release history starts at `1.18.0`), so this isn't a case of an old real version lingering — it's a placeholder from early scaffolding that was never wired up.

**Practical takeaway for `turtape`:** don't rely on the CLI's own version output for feature/compat checks. The PyPI/GitHub release version (`1.36` currently) is the accurate one — it's tracked properly via git tags. This is a packaging/versioning bug, not evidence the project is unmaintained: commit activity on `main` is active (daily commits, biweekly releases) — see the overall assessment in [nightly Docker tag is stale](/turingdb-issues/nightly-build-disabled) for the separate (also real) Docker tag staleness issue.
