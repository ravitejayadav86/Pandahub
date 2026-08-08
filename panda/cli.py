"""panda.cli — Entry point for the `panda` command."""
from __future__ import annotations

import click

from panda.commands import auth as auth_commands
from panda.commands import repo as repo_commands


@click.group()
@click.version_option(package_name="panda-cli")
def main():
    """panda — the PandaHub command-line tool.

    Get started with:

      panda login              Log in to your PandaHub account
      panda repo create <name> Create a new repository
      panda repo list          List your repositories
      panda token create <name> Create a token for git push/pull
    """


main.add_command(auth_commands.login)
main.add_command(auth_commands.logout)
main.add_command(auth_commands.whoami)
main.add_command(auth_commands.token)
main.add_command(repo_commands.repo)


if __name__ == "__main__":
    main()
