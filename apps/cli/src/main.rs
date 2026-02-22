use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

mod commands;

#[derive(Parser)]
#[command(name = "rad-bench")]
#[command(about = "RAD Bench — Realtime, Analytical & Data Engineering Agent Evals")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start one or more eval containers
    Run(commands::run::RunArgs),
    /// List available scenarios
    List(commands::list::ListArgs),
    /// Collect and display results from completed runs
    Results(commands::results::ResultsArgs),
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Run(args) => commands::run::execute(args).await,
        Commands::List(args) => commands::list::execute(args).await,
        Commands::Results(args) => commands::results::execute(args).await,
    }
}
