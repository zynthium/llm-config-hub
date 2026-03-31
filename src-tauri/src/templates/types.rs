use serde::Deserialize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BuiltinTargetTemplate {
    pub id: String,
    pub name: String,
    pub order: usize,
    pub is_remote: bool,
    pub bash_script: String,
    pub save_as_default_script: String,
    pub restore_default_script: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinTemplateManifest {
    pub id: String,
    pub name: String,
    pub order: usize,
    pub is_remote: bool,
    pub scripts: BuiltinTemplateScriptPaths,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinTemplateScriptPaths {
    pub deploy: String,
    pub save_default: String,
    pub restore_default: String,
}
