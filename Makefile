.PHONY: e2e lighthouse security-scan help

help:
	@echo "Wardix Commands:"
	@echo "  make e2e           - Run Playwright E2E tests"
	@echo "  make lighthouse    - Run Lighthouse CI audit"
	@echo "  make security-scan - Run npm audit and license checks"

e2e:
	@echo "🎭 Running Playwright E2E tests (demo mode)..."
	npx playwright test

lighthouse:
	@echo "🔦 Running Lighthouse CI audit..."
	npx lhci autorun

security-scan:
	@echo "=== NPM AUDIT ==="
	npm audit --audit-level=high || true
	@echo ""
	@echo "=== LICENSE CHECK ==="
	npx license-checker --production --failOn "GPL-3.0;AGPL-3.0" --summary || true
