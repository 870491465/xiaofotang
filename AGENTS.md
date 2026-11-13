# Repository Guidelines

## Project Structure & Module Organization

This is a Cocos Creator 3.8.8 project. Runtime TypeScript lives in `assets/scripts/`; `Courtyard.ts` coordinates the main scene, while focused files such as `HomeView.ts`, `MotionPlayer.ts`, and `CharacterProfile.ts` own individual concerns. The entry scene is `assets/scenes/Main.scene`. Art and audio belong under `assets/art/` and `assets/audio/`, together with their Cocos-generated `.meta` files. Integration notes and source asset packages are in `docs/`. Deterministic checks, fixtures, snapshots, and build logs are kept in `validation/`.

Do not hand-edit or commit generated `library/`, `temp/`, `build/`, `profiles/`, or `node_modules/` content.

## Build, Test, and Development Commands

- Open the repository in Cocos Creator **3.8.8**, load `assets/scenes/Main.scene`, and use Preview for local iteration.
- Build with **Project > Build**, selecting Web Mobile. Output is generated in `build/web-mobile/` and must be served over HTTP rather than opened with `file://`.
- Run `node validation/check-prototype.cjs` for deterministic gameplay, motion, layout, and scene-binding regression checks. The script uses Creator's bundled TypeScript by default; an alternate `typescript.js` path may be passed as its first argument.
- Set `COURTYARD_CHECK_HOME=1` or `COURTYARD_CHECK_MALE=1` before the same command to exercise the corresponding fixture suite.

Binding scripts such as `validation/bind-art.cjs` are repair tools, not routine setup; run them only after the relevant import has completed and the integration notes call for them.

## Coding Style & Naming Conventions

Use TypeScript with four-space indentation, single quotes, semicolons, and explicit component/property types. Name Cocos component classes and files in `PascalCase`, methods and variables in `camelCase`, and constants in `UPPER_SNAKE_CASE`. Keep decorators (`@ccclass`, `@property`) near the fields they expose. Preserve asset UUIDs and commit every asset together with its `.meta` partner.

## Testing Guidelines

Add logic regressions to the relevant `validation/*-cases.cjs` suite. Test names should describe observable behavior, not implementation details. A passing Node suite does not replace Creator preview, Web Mobile build, or device checks for rendering, audio timing, safe areas, and touch interaction. Review changed snapshots and logs; do not treat regenerated output alone as proof of correctness.

## Commit & Pull Request Guidelines

The repository currently has no commit history to establish a convention. Use short imperative subjects, optionally scoped, for example `motion: fix incense frame timing`. Keep asset, `.meta`, scene-binding, and code changes together when they form one feature. Pull requests should summarize behavior changes, list validation performed, link the relevant issue, and include screenshots or recordings for visual, animation, or layout changes.
