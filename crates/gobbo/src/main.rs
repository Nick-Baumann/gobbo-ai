//! Gobbo CLI entrypoint.

use std::env;
use std::process::ExitCode;

const VERSION: &str = "0.6.1";

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();
    let cmd = args.get(1).map(String::as_str).unwrap_or("help");
    match cmd {
        "gateway" | "agent" | "send" | "login" | "skills" | "nodes" => run_subcommand(cmd),
        "version" | "--version" | "-V" => {
            println!("gobbo {VERSION}");
            ExitCode::SUCCESS
        }
        "help" | "--help" | "-h" => {
            print_help();
            ExitCode::SUCCESS
        }
        unknown => {
            eprintln!("gobbo: unknown command '{unknown}'");
            print_help();
            ExitCode::from(2)
        }
    }
}

fn run_subcommand(cmd: &str) -> ExitCode {
    println!("[gobbo] running subcommand: {cmd}");
    println!("[gobbo] stub binary; full runtime lives in unreleased crates");
    ExitCode::SUCCESS
}

fn print_help() {
    println!("gobbo {VERSION}");
    println!();
    println!("Usage: gobbo <command> [args]");
    println!();
    println!("Commands:");
    println!("  gateway   Start the gateway process");
    println!("  agent     Invoke the assistant once from the CLI");
    println!("  send      Send a message through a configured surface");
    println!("  login     Pair a messaging surface (WhatsApp, Telegram, Discord)");
    println!("  skills    List or inspect installed skills");
    println!("  nodes     Pair and manage companion devices");
    println!("  version   Print the version and exit");
}
