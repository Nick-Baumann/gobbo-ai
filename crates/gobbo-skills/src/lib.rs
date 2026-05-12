//! Skill registry and SKILL.md parsing primitives.

/// A single skill loaded from disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skill {
    pub name: String,
    pub summary: String,
    pub directory: String,
}

impl Skill {
    pub fn new(
        name: impl Into<String>,
        summary: impl Into<String>,
        dir: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            summary: summary.into(),
            directory: dir.into(),
        }
    }
}

/// Parse a `SKILL.md` body into a `Skill` definition. The first non-blank
/// line is the skill name; the rest of the first paragraph is the summary.
pub fn parse_skill_md(body: &str, directory: &str) -> Option<Skill> {
    let mut lines = body.lines().filter(|l| !l.trim().is_empty());
    let name = lines.next()?.trim_start_matches('#').trim();
    let summary: String = lines
        .take_while(|l| !l.starts_with('#'))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();
    Some(Skill::new(name, summary, directory))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_minimal_skill_md() {
        let body = "# browser\n\nDrive a headless browser. Useful for scraping.";
        let s = parse_skill_md(body, "skills/browser").unwrap();
        assert_eq!(s.name, "browser");
        assert!(s.summary.starts_with("Drive a headless browser"));
        assert_eq!(s.directory, "skills/browser");
    }

    #[test]
    fn ignores_subsequent_headers_in_summary() {
        let body = "# search\n\nQuery the web.\n\n# arguments\n\nq: string";
        let s = parse_skill_md(body, "skills/search").unwrap();
        assert_eq!(s.name, "search");
        assert_eq!(s.summary, "Query the web.");
    }
}
