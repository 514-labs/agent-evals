use anyhow::Result;
use clap::Args;

#[derive(Args)]
pub struct ListArgs {
    /// Filter by difficulty tier (e.g., tier-1, tier-2, tier-3)
    #[arg(long)]
    pub tier: Option<String>,

    /// Filter by business domain (e.g., ecommerce, fintech, iot)
    #[arg(long)]
    pub domain: Option<String>,

    /// Filter by task category (e.g., schema-design, query-optimization, ingestion)
    #[arg(long)]
    pub category: Option<String>,
}

pub async fn execute(args: ListArgs) -> Result<()> {
    println!("Available scenarios:");
    println!();

    // Stub: print example scenario entries
    let scenarios = vec![
        ("sch-001", "tier-1", "ecommerce",   "schema-design",     "E-commerce order schema design"),
        ("qry-001", "tier-2", "fintech",     "query-optimization","Financial reporting query optimization"),
        ("ing-001", "tier-2", "iot",         "ingestion",         "IoT sensor data ingestion pipeline"),
        ("mig-001", "tier-3", "ecommerce",   "migration",         "MySQL to ClickHouse migration"),
        ("dbg-001", "tier-1", "analytics",   "debugging",         "Slow query diagnosis"),
    ];

    let filtered: Vec<_> = scenarios
        .iter()
        .filter(|(_, tier, domain, category, _)| {
            args.tier.as_deref().map_or(true, |t| *tier == t)
                && args.domain.as_deref().map_or(true, |d| *domain == d)
                && args.category.as_deref().map_or(true, |c| *category == c)
        })
        .collect();

    if filtered.is_empty() {
        println!("No scenarios match the given filters.");
        return Ok(());
    }

    println!("{:<10} {:<8} {:<12} {:<22} {}", "ID", "TIER", "DOMAIN", "CATEGORY", "DESCRIPTION");
    println!("{}", "-".repeat(80));
    for (id, tier, domain, category, desc) in filtered {
        println!("{:<10} {:<8} {:<12} {:<22} {}", id, tier, domain, category, desc);
    }
    println!();
    println!("NOTE: Scenario registry not yet implemented. Showing stub data.");

    Ok(())
}
