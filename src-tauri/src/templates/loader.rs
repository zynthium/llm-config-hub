use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{path::BaseDirectory, AppHandle, Manager, Runtime};
use thiserror::Error;

use super::types::{BuiltinTargetTemplate, BuiltinTemplateManifest};

#[derive(Debug, Error)]
pub enum TemplateLoadError {
    #[error("failed to resolve builtin template resources: {0}")]
    Resolve(#[from] tauri::Error),
    #[error("failed to read builtin template directory {path}: {source}")]
    ReadDirectory {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to read builtin template manifest {path}: {source}")]
    ReadManifest {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse builtin template manifest {path}: {source}")]
    ParseManifest {
        path: PathBuf,
        #[source]
        source: serde_json::Error,
    },
    #[error("failed to read builtin template script {path}: {source}")]
    ReadScript {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("no builtin templates found in {path}")]
    NoTemplatesFound { path: PathBuf },
    #[error("duplicate builtin template id `{id}`")]
    DuplicateTemplateId { id: String },
}

pub fn load_builtin_templates<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Vec<BuiltinTargetTemplate>, TemplateLoadError> {
    let root = app
        .path()
        .resolve("templates/builtin", BaseDirectory::Resource)?;
    load_builtin_templates_from_dir(root)
}

pub fn load_builtin_templates_from_dir<P: AsRef<Path>>(
    root: P,
) -> Result<Vec<BuiltinTargetTemplate>, TemplateLoadError> {
    let root = root.as_ref().to_path_buf();
    let directory_entries = fs::read_dir(&root).map_err(|source| TemplateLoadError::ReadDirectory {
        path: root.clone(),
        source,
    })?;

    let mut template_dirs = directory_entries
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| path.is_dir())
        .collect::<Vec<_>>();

    template_dirs.sort();

    if template_dirs.is_empty() {
        return Err(TemplateLoadError::NoTemplatesFound { path: root });
    }

    let mut seen_ids = HashSet::new();
    let mut templates = Vec::with_capacity(template_dirs.len());

    for template_dir in template_dirs {
        let template = load_builtin_template_from_dir(&template_dir)?;
        if !seen_ids.insert(template.id.clone()) {
            return Err(TemplateLoadError::DuplicateTemplateId { id: template.id });
        }
        templates.push(template);
    }

    templates.sort_by(|left, right| {
        left.order
            .cmp(&right.order)
            .then_with(|| left.id.cmp(&right.id))
    });

    Ok(templates)
}

fn load_builtin_template_from_dir(
    template_dir: &Path,
) -> Result<BuiltinTargetTemplate, TemplateLoadError> {
    let manifest_path = template_dir.join("manifest.json");
    let manifest = fs::read_to_string(&manifest_path)
        .map_err(|source| TemplateLoadError::ReadManifest {
            path: manifest_path.clone(),
            source,
        })
        .and_then(|content| {
            serde_json::from_str::<BuiltinTemplateManifest>(&content).map_err(|source| {
                TemplateLoadError::ParseManifest {
                    path: manifest_path.clone(),
                    source,
                }
            })
        })?;

    Ok(BuiltinTargetTemplate {
        id: manifest.id,
        name: manifest.name,
        order: manifest.order,
        is_remote: manifest.is_remote,
        bash_script: read_script(template_dir, &manifest.scripts.deploy)?,
        save_as_default_script: read_script(template_dir, &manifest.scripts.save_default)?,
        restore_default_script: read_script(template_dir, &manifest.scripts.restore_default)?,
    })
}

fn read_script(template_dir: &Path, file_name: &str) -> Result<String, TemplateLoadError> {
    let script_path = template_dir.join(file_name);
    fs::read_to_string(&script_path).map_err(|source| TemplateLoadError::ReadScript {
        path: script_path,
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn load_builtin_templates_reads_manifest_and_scripts() {
        let root = create_temp_template_root("loader-success");
        write_template(
            &root,
            "claude-code",
            "Claude Code",
            10,
            false,
            Some("restore_default.sh"),
        );

        let templates = load_builtin_templates_from_dir(&root).expect("templates should load");
        let template = templates.first().expect("template should exist");

        assert_eq!(template.id, "claude-code");
        assert_eq!(template.name, "Claude Code");
        assert_eq!(template.order, 10);
        assert!(!template.is_remote);
        assert_eq!(template.bash_script, "#!/usr/bin/env bash\necho deploy\n");
        assert_eq!(
            template.save_as_default_script,
            "#!/usr/bin/env bash\necho save\n"
        );
        assert_eq!(
            template.restore_default_script,
            "#!/usr/bin/env bash\necho restore\n"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn load_builtin_templates_fails_when_script_is_missing() {
        let root = create_temp_template_root("loader-missing-script");
        write_template(
            &root,
            "claude-code",
            "Claude Code",
            10,
            false,
            None,
        );

        let error = load_builtin_templates_from_dir(&root)
            .expect_err("missing restore script should fail");

        assert!(matches!(error, TemplateLoadError::ReadScript { .. }));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn packaged_builtin_templates_are_complete() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/templates/builtin");

        let templates =
            load_builtin_templates_from_dir(root).expect("packaged builtin templates should load");

        assert_eq!(templates.len(), 5);
        assert_eq!(
            templates.iter().map(|template| template.id.as_str()).collect::<Vec<_>>(),
            vec!["claude-code", "codex", "gemini-cli", "opencode", "cursor"]
        );
        assert!(templates.iter().all(|template| !template.bash_script.is_empty()));
        assert!(
            templates
                .iter()
                .all(|template| !template.save_as_default_script.is_empty())
        );
        assert!(
            templates
                .iter()
                .all(|template| !template.restore_default_script.is_empty())
        );
    }

    fn create_temp_template_root(label: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("current time should be after unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("llm-config-hub-{label}-{timestamp}"));
        fs::create_dir_all(&root).expect("temp root should be created");
        root
    }

    fn write_template(
        root: &Path,
        id: &str,
        name: &str,
        order: usize,
        is_remote: bool,
        restore_script_name: Option<&str>,
    ) {
        let template_dir = root.join(id);
        fs::create_dir_all(&template_dir).expect("template dir should be created");

        let manifest = format!(
            r#"{{
  "id": "{id}",
  "name": "{name}",
  "order": {order},
  "isRemote": {is_remote},
  "scripts": {{
    "deploy": "deploy.sh",
    "saveDefault": "save-default.sh",
    "restoreDefault": "{}"
  }}
}}"#,
            restore_script_name.unwrap_or("missing-restore.sh")
        );

        fs::write(template_dir.join("manifest.json"), manifest)
            .expect("manifest should be written");
        fs::write(template_dir.join("deploy.sh"), "#!/usr/bin/env bash\necho deploy\n")
            .expect("deploy script should be written");
        fs::write(
            template_dir.join("save-default.sh"),
            "#!/usr/bin/env bash\necho save\n",
        )
        .expect("save script should be written");

        if let Some(file_name) = restore_script_name {
            fs::write(
                template_dir.join(file_name),
                "#!/usr/bin/env bash\necho restore\n",
            )
            .expect("restore script should be written");
        }
    }
}
