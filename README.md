# AtomiTron

An interactive chemistry explorer for a young learner. Start at the periodic
table, combine elements, and dig as deep as curiosity goes. Every fact links to
a whitelisted source (PubChem, NIST Chemistry WebBook, or LibreTexts
Chemistry), and nothing ships without a passing verification record.

- Spec: [docs/requirements.md](docs/requirements.md)
- Project rules: [CLAUDE.md](CLAUDE.md)
- Data schema: [data/schema/](data/schema/)

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # schema tests + verified-data gate
npm run build      # typecheck, then build to dist/
npm run preview    # serve the built site
```

## Deploy to GitHub Pages

Live at <https://jarretmorton.github.io/AtomiTron/>, on the same host as Rock ID
and Addonaut. Unlike those, AtomiTron has a build step, so it deploys through
GitHub Actions instead of straight from the branch.

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. [The workflow](.github/workflows/deploy.yml) runs the tests,
   builds, and publishes `dist/`. If any test fails, nothing deploys.

Pull requests run the tests and the build but don't deploy.

## Icons

`app/public/icon.svg` is the master. Regenerate the PNGs with
`python scripts/make_icons.py` (needs Pillow).
