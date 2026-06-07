# Contributing to Wardix

First off, thank you for considering contributing to Wardix! We welcome contributions from everyone—whether it's fixing bugs, improving documentation, or proposing new features for our agent-auth control plane.

## Getting Started

Wardix is structured as a standard Next.js 16 App Router project with unified backend logic:
1. **`src/app/`**: Next.js App Router pages and console API endpoints.
2. **`src/components/`**: React 19 UI components.
3. **`src/lib/`**: Core logic (T3N client integration, policy evaluation, local database client).
4. **`scripts/`**: Scenario seeding, block verification, and performance benchmark scripts.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.8+, only needed for benchmarking latency)

### Local Development

#### 1. Setup & Installation
```bash
npm install
cp .env.example .env.local
```
Update `.env.local` with your claimed `T3N_SANDBOX_TOKEN` (see `docs/BUGS.md` or the Terminal 3 portal for details).

#### 2. Run Quality Checks
To format, lint, typecheck, and execute the full test coverage suite:
```bash
npm run ci
```

#### 3. Run Scenario Verification & Benchmarks
```bash
npx tsx scripts/verify_blocks.ts
python3 scripts/bench.py
```

#### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` to view the live dashboard.

## Pull Request Process

1. **Fork the repository** and create your branch from `main`.
2. **Write tests** for any new features or bug fixes.
3. **Ensure CI passes**: Our GitHub Actions will automatically run `npm run ci` which audits dependencies, lints, typechecks, and runs the Vitest coverage tests.
4. **Descriptive Commits**: Use clear, detailed git commit messages indicating what your PR solves.
5. **Update Documentation**: If you change APIs or add features, update `README.md` or relevant documentation.

## Code Style

- **TypeScript/JavaScript**: We use ESLint and TypeScript strict mode. Ensure `npm run lint` and `npm run typecheck` pass without warnings.
- **Testing Coverage**: We enforce **100% statement, branch, function, and line coverage** on code files. Ensure your tests keep coverage at 100%.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and constructive in issues and pull requests.
