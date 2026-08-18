"""panda.cli - Entry point for the PandaHub CLI."""
from __future__ import annotations

import click

from panda.commands import auth as auth_commands
from panda.commands import repo as repo_commands
from panda.commands import git_cmd


@click.group()
@click.version_option(package_name="panda-cli")
def main():
    """panda - the PandaHub command-line tool."""


# Authentication
main.add_command(auth_commands.login)
main.add_command(auth_commands.logout)
main.add_command(auth_commands.whoami)
main.add_command(auth_commands.token)


# Repository management
main.add_command(repo_commands.repo)

# Top-level Git/Panda commands
main.add_command(git_cmd.clone)
main.add_command(git_cmd.init_repo, name="init")
main.add_command(git_cmd.status)
main.add_command(git_cmd.add)
main.add_command(git_cmd.commit)
main.add_command(git_cmd.push)
main.add_command(git_cmd.pull)
main.add_command(git_cmd.fetch)
main.add_command(git_cmd.branch)
main.add_command(git_cmd.switch)
main.add_command(git_cmd.merge)
main.add_command(git_cmd.log)
main.add_command(git_cmd.diff)
main.add_command(git_cmd.remote)
main.add_command(git_cmd.tag)
main.add_command(git_cmd.stash)
main.add_command(git_cmd.restore)

# Explicit PandaHub remote helper
main.add_command(git_cmd.remote_add)

# Internal Git credential helper
main.add_command(git_cmd.git_credential)

# Also expose clone through `panda repo clone`
repo_commands.repo.add_command(git_cmd.clone, name="clone")


if __name__ == "__main__":
    main()