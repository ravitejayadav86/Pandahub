"""panda.cli - Entry point for the `panda` command."""
from __future__ import annotations

import click

from panda.commands import auth as auth_commands
from panda.commands import repo as repo_commands
from panda.commands import git_cmd


@click.group()
@click.version_option(package_name="panda-cli")
def main():
    """panda - the PandaHub command-line tool."""


main.add_command(auth_commands.login)
main.add_command(auth_commands.logout)
main.add_command(auth_commands.whoami)
main.add_command(auth_commands.token)
main.add_command(repo_commands.repo)
main.add_command(git_cmd.clone)
main.add_command(git_cmd.remote_add)
main.add_command(git_cmd.git_credential)


if __name__ == "__main__":
    main()