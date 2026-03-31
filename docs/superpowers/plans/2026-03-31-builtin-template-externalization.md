# Builtin Template Externalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move builtin target templates out of `secure_store.rs` into packaged resource files while preserving current runtime behavior.

**Architecture:** Add a small template loading layer under `src-tauri/src/templates/` that reads packaged resources from `src-tauri/resources/templates/builtin/<id>/`. `SecureStore` keeps ownership of syncing builtin targets into encrypted state, but it consumes loader output instead of hardcoded script constants.

**Tech Stack:** Rust, Tauri v2 packaged resources, serde/serde_json, existing Rust unit tests.

---

## Chunk 1: Resource-backed builtin template loader

### Task 1: Define template file format and Rust types
**Files:**
- Create: `src-tauri/src/templates/types.rs`
- Modify: `src-tauri/src/templates/mod.rs`

- [ ] Define manifest/resource structs for builtin template metadata and script mappings.
- [ ] Export the types from `templates/mod.rs`.

### Task 2: Implement loader
**Files:**
- Create: `src-tauri/src/templates/loader.rs`
- Modify: `src-tauri/src/templates/mod.rs`

- [ ] Add a loader that resolves the packaged `templates/builtin` resource directory.
- [ ] Parse each `manifest.json` and read referenced shell script files.
- [ ] Return ordered builtin template definitions with explicit errors for missing files or invalid manifests.

### Task 3: Add loader tests
**Files:**
- Modify: `src-tauri/src/templates/loader.rs`

- [ ] Write failing tests for manifest parsing and missing-script failure.
- [ ] Implement minimal test helpers and make tests pass.

## Chunk 2: Replace hardcoded builtin target definitions

### Task 4: Add packaged builtin template files
**Files:**
- Create: `src-tauri/resources/templates/builtin/*/manifest.json`
- Create: `src-tauri/resources/templates/builtin/*/deploy.sh`
- Create: `src-tauri/resources/templates/builtin/*/save-default.sh`
- Create: `src-tauri/resources/templates/builtin/*/restore-default.sh`

- [ ] Move each builtin target script into its own resource directory.
- [ ] Keep ids and behavior aligned with current builtin targets.

### Task 5: Wire loader into store initialization
**Files:**
- Modify: `src-tauri/src/services/secure_store.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] Remove hardcoded builtin script constants from `secure_store.rs`.
- [ ] Load builtin templates once during app setup and pass them into `SecureStore`.
- [ ] Keep builtin sync behavior unchanged for existing saved targets.

### Task 6: Preserve create/update behavior
**Files:**
- Modify: `src-tauri/src/services/secure_store.rs`

- [ ] Keep custom target persistence intact for save/restore scripts.
- [ ] Keep builtin targets immutable from the UI.

## Chunk 3: Validation and packaging

### Task 7: Configure resource packaging
**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] Add the builtin template resource directory to Tauri packaging.

### Task 8: Add regression coverage
**Files:**
- Modify: `src-tauri/src/services/secure_store.rs`

- [ ] Keep/adjust builtin sync regression tests to use loaded template data.
- [ ] Verify old builtin entries are repaired from packaged templates.

### Task 9: Run validation
**Files:**
- Modify: `eslint.config.js` only if needed for build outputs

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `CARGO_TARGET_DIR=/tmp/llm-config-hub-target cargo test` for relevant Rust tests.
- [ ] Run `CARGO_TARGET_DIR=/tmp/llm-config-hub-target cargo check`.
