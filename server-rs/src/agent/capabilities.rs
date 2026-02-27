use std::path::PathBuf;
use tokio::fs;
use serde::{Deserialize, Serialize};
use dashmap::DashMap;

/// Represents a dynamic skill loaded from `data/skills/*.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDefinition {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
    pub execution_command: String,
    pub schema: serde_json::Value,
    pub doc_url: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// Represents a dynamic workflow loaded from `data/workflows/*.md`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: Option<String>,
    pub name: String,
    pub content: String,
    pub doc_url: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// The Capabilities registry holding in-memory maps of skills and workflows.
pub struct CapabilitiesRegistry {
    skills_dir: PathBuf,
    workflows_dir: PathBuf,
    pub skills: DashMap<String, SkillDefinition>,
    pub workflows: DashMap<String, WorkflowDefinition>,
}

impl CapabilitiesRegistry {
    pub async fn new() -> anyhow::Result<Self> {
        let data_dir = std::env::var("DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let cwd = std::env::current_dir().unwrap_or_default();
                if cwd.ends_with("server-rs") {
                    PathBuf::from("data")
                } else if cwd.join("server-rs").exists() {
                    PathBuf::from("server-rs/data")
                } else {
                    PathBuf::from("data")
                }
            });
        let skills_dir = data_dir.join("skills");
        let workflows_dir = data_dir.join("workflows");

        // Ensure directories exist
        fs::create_dir_all(&skills_dir).await?;
        fs::create_dir_all(&workflows_dir).await?;

        let registry = Self {
            skills_dir,
            workflows_dir,
            skills: DashMap::new(),
            workflows: DashMap::new(),
        };

        registry.reload_all().await?;
        Ok(registry)
    }

    /// Read all defined skills and workflows from disk into memory
    pub async fn reload_all(&self) -> anyhow::Result<()> {
        let new_skills = DashMap::new();
        let new_workflows = DashMap::new();

        // Load Skills
        let mut skill_entries = fs::read_dir(&self.skills_dir).await?;
        while let Some(entry) = skill_entries.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path).await {
                    if let Ok(skill) = serde_json::from_str::<SkillDefinition>(&content) {
                        new_skills.insert(skill.name.clone(), skill);
                    } else {
                        tracing::warn!("Failed to parse skill file: {:?}", path);
                    }
                }
            }
        }

        // Load Workflows
        let mut wf_entries = fs::read_dir(&self.workflows_dir).await?;
        while let Some(entry) = wf_entries.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                let name = path.file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or_default()
                    .to_string();
                
                if let Ok(content) = fs::read_to_string(&path).await {
                    new_workflows.insert(name.clone(), WorkflowDefinition { 
                        id: None,
                        name, 
                        content,
                        doc_url: None,
                        tags: None
                    });
                }
            }
        }

        // Atomic swap (clearing and then replacing in a tight loop to minimize window)
        // Note: DashMap doesn't have a single-op 'replace_all', so we clear/insert.
        self.skills.clear();
        for kv in new_skills {
            self.skills.insert(kv.0, kv.1);
        }

        self.workflows.clear();
        for kv in new_workflows {
            self.workflows.insert(kv.0, kv.1);
        }

        tracing::info!("Loaded {} skills and {} workflows from disk", self.skills.len(), self.workflows.len());
        Ok(())
    }

    pub async fn save_skill(&self, skill: SkillDefinition) -> anyhow::Result<()> {
        // Sanitize name for filename
        let safe_name = skill.name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        let path = self.skills_dir.join(format!("{}.json", safe_name));
        
        let content = serde_json::to_string_pretty(&skill)?;
        fs::write(&path, content).await?;
        
        self.skills.insert(skill.name.clone(), skill);
        Ok(())
    }

    pub async fn delete_skill(&self, name: &str) -> anyhow::Result<()> {
        let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        let path = self.skills_dir.join(format!("{}.json", safe_name));
        
        if path.exists() {
            fs::remove_file(path).await?;
        }
        self.skills.remove(name);
        Ok(())
    }

    pub async fn save_workflow(&self, workflow: WorkflowDefinition) -> anyhow::Result<()> {
        let safe_name = workflow.name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        let path = self.workflows_dir.join(format!("{}.md", safe_name));
        
        fs::write(&path, &workflow.content).await?;
        
        self.workflows.insert(workflow.name.clone(), workflow);
        Ok(())
    }

    pub async fn delete_workflow(&self, name: &str) -> anyhow::Result<()> {
        let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
        let path = self.workflows_dir.join(format!("{}.md", safe_name));
        
        if path.exists() {
            fs::remove_file(path).await?;
        }
        self.workflows.remove(name);
        Ok(())
    }
}
