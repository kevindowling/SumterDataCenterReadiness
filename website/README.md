# Sumter Field Desk website

This dependency-free site reads its content from `/research/*.md`. To run it:

```bash
cd website
npm run dev
```

Then open `http://localhost:4173/`.

Run `npm run check` to verify that every research file and site asset exists. No package installation is required.

## GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` validates the project, assembles `website/` and `research/` into a static artifact, and deploys it from `main`. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

The original source report is deliberately excluded by `.gitignore` and is never copied into the Pages artifact.
