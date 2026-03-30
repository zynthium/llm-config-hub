# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Overview

LLM Config Hub is a macOS desktop app for managing LLM configurations, built with Tauri V2 (React + Rust).

## Build and Test Commands

```bash
npm run tauri:dev    # Dev mode (Vite + Rust with hot reload)
npm run tauri:build  # Production build
npm run dev          # Frontend only
npm run build        # TypeScript check + build
npm run lint         # ESLint check
npm run preview      # Preview production build
```

## Definition of Done

A task is complete when ALL of the following pass:
1. `npm run lint` exits 0
2. `npm run build` exits 0
3. No TypeScript errors

## When Writing Code

- Run `npm run lint` after every file change
- Run `npm run build` before marking complete
- Use functional components with hooks for React
- Use `clsx` + `tailwind-merge` for conditional classes
- Prefer `type` over `interface` for simple types

## When Writing Rust

- Use `thiserror` for error handling
- Async Rust with `tokio`
- Secure sensitive data via `keyring` crate (macOS Keychain)
- Structured logging with `tauri-plugin-log`

## Frontend-Backend Communication

Frontend calls Rust via Tauri's `invoke` API. Wrap commands in `src/lib/`.

## UI Guidelines

Baseline: shadcn-ui `size="sm"` components.

| Element | Size |
|---------|------|
| Body/Labels | `text-xs` |
| Headers | `text-sm font-semibold` |
| Icons | `w-3.5 h-3.5` (actions) / `w-4 h-4` (close) |
| Buttons | `size="sm"`; icon buttons `h-7 w-7` |
| Inputs | `h-8 text-xs px-2.5` |

Color: Success `green-*`, Remote `purple-*`, Primary `blue-*`, Danger `red-*`.

## Security

- API keys: stored encrypted via `keyring` (macOS Keychain)
- Never log sensitive data
- Tauri capabilities restrict frontend access

## When Blocked

- If Rust build fails: check `cargo check` in `src-tauri/`
- If frontend build fails: check `npm run build` output
- Never delete lock files or force push

## Project Structure

```
src/                    # React frontend
  components/          # ConfigManager, ConfigModal, DeployModal, etc.
  lib/                # Tauri command wrappers
  types.ts            # TypeScript types (LLMConfig, ExportTarget)
src-tauri/src/        # Rust backend
  commands/           # health, model, target, clipboard, shell, import
  services/           # health_check, secure_store, ssh_client
```

## Additional Guides

- App icon update process: `docs/app-icon.md`
