# Roma Hub — Portfolio Demo

Independent, sanitized PWA for choir management and PDF score reading. No production database or private choir content. Local-first demo; backend actions disabled.

## Run
```sh
python3 scripts/import_scores.py
python3 -m http.server 8000 --directory src
```
Open http://localhost:8000. Serve the src directory at the root. Public-domain editions are independently sourced; see SCORES.md. Third-party libraries retain their licenses.
