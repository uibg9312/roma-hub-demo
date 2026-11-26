# Roma Hub — Portfolio Demo

Independent local-first PWA for choir management, PDF score reading, study and SATB starting tones. Uses a separate public-domain sample catalog and no production database, OAuth, choir membership or server-side MIDI processing. Preferences and PDF caches are local to this origin.

## Run

```sh
python3 -m http.server 8000 --directory src
```

Vercel: static project with root directory `src` and output directory `.`. No environment variables or production services are required. Public-domain editions are independently sourced; see SCORES.md. Third-party libraries retain their licenses.

## Update policy

Copy reviewed application code only from the official project, never merge its history or copy its catalog, credentials, real study tracks, notes, private assets, or deployment configuration. Preserve the demo config and synthetic data. Check every change before publication.
