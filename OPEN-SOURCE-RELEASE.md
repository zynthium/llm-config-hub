# Open Source Release Plan

- License: MIT (root level). This repository is released under the MIT license at the project root. Individual modules may contain their own licenses; this document documents the overarching policy and release plan.
- Scope: This plan covers repository-wide licensing, contribution guidelines, and release readiness checks for an open-source publication.
- What to publish:
- 1) LICENSE at repo root (MIT)
- 2) OPEN-SOURCE-RELEASE.md (this document)
- 3) Brief release notes in CHANGELOG.md if present, or a SUMMARY in RELEASE_NOTES.md
- 4) CONTRIBUTING.md with contribution guidelines (if not present, reference existing docs in this repo)

## Licensing decisions
- Root LICENSE provides MIT licensing for the entire repository content unless overridden by submodules with their own licenses. If there are submodules with different licenses, include a NOTICE/LICENCE list at the root and preserve the original licenses in each module.
- Ensure license compatibility with dependencies. If any dependency has copyleft requirements, document accordingly.

## Publication readiness checks
- [ ] Root LICENSE exists and clearly states the chosen license (MIT).
- [ ] All code paths under the root path are covered by the license and there is no conflicting license text that would override MIT.
- [ ] No hard-coded secrets or credentials are present (already confirmed in prior scan).
- [ ] Sensitive files (env files, db files, keys) are ignored by Git (verify via .gitignore) or relocated.
- [ ] CHANGELOG/RELEASE_NOTES exists or will be generated for the initial public release.
- [ ] Documentation clarifies how to contribute (CONTRIBUTING.md or equivalent guidance).
- [ ] A minimal CI check is configured to verify license presence and basic checks on PRs (optional but recommended).

## Contribution guidance (summary)
- Submit changes via pull requests against the main branch.
- All contributions should pass tests and pass any linting checks configured in the repository.
- Maintainers reserve the right to request changes for license, security, or policy reasons.

## Next steps
- If you want, I can commit these changes and push a release branch, then open a PR with a short summary of licensing decisions and the release plan.
