use anyhow::Result;
use clap::Args;
use tracing::info;

#[derive(Args)]
pub struct RunArgs {
    /// Scenario ID to run
    #[arg(short, long)]
    pub scenario: Option<String>,

    /// Evaluation harness to use
    #[arg(long, default_value = "default")]
    pub harness: String,

    /// Agent persona
    #[arg(long, value_enum, default_value = "naive")]
    pub persona: Persona,

    /// Planning mode
    #[arg(long, value_enum, default_value = "no-plan")]
    pub mode: PlanMode,

    /// Run all scenario/persona/mode combinations
    #[arg(long)]
    pub matrix: bool,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum Persona {
    Naive,
    Savvy,
}

#[derive(clap::ValueEnum, Clone, Debug)]
pub enum PlanMode {
    Plan,
    NoPlan,
}

pub async fn execute(args: RunArgs) -> Result<()> {
    if args.matrix {
        info!("Running full eval matrix");
        println!("Running full evaluation matrix (all scenarios × personas × modes)...");
        println!("NOTE: Container orchestration not yet implemented.");
        return Ok(());
    }

    let scenario = args.scenario.as_deref().unwrap_or("<none>");
    info!(scenario, harness = %args.harness, "Starting eval run");

    println!("Starting eval run:");
    println!("  Scenario: {}", scenario);
    println!("  Harness:  {}", args.harness);
    println!("  Persona:  {:?}", args.persona);
    println!("  Mode:     {:?}", args.mode);
    println!();
    println!("Steps (stub):");
    println!("  1. Load scenario definition from JSON");
    println!("  2. Build container config (env vars, image, mounts)");
    println!("  3. Use bollard to start the Docker container");
    println!("  4. Stream container logs");
    println!("  5. Wait for exit, collect output");
    println!("  6. Write results to JSON file");
    println!();
    println!("NOTE: Container orchestration not yet implemented.");

    Ok(())
}
