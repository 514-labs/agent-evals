use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

mod commands;

#[derive(Parser)]
#[command(name = "dec-bench")]
#[command(about = "DEC Bench — Data Engineering Competency Agent Evals")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Manage scenario and harness registry entries
    Registry(commands::registry::RegistryArgs),
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
        Commands::Registry(args) => commands::registry::execute(args).await,
        Commands::Run(args) => commands::run::execute(args).await,
        Commands::List(args) => commands::list::execute(args).await,
        Commands::Results(args) => commands::results::execute(args).await,
    }
}
