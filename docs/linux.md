# Linux

On Linux, `kombinat install` runs the daemon as a systemd user service. Routines, the dashboard and the other commands work the same as on macOS. Unlike on macOS, the daemon does not stop the machine from sleeping.

## What you need

- systemd 240 or newer with user services: `systemctl --user status` works in your shell. Most desktop and server distributions have them. Plain containers, WSL without systemd and Alpine do not, see [Without systemd](#without-systemd).
- Node 24.
- The agents your routines use, logged in as the same user: Claude Code (`claude auth status`) and Codex (`codex login`).

## Install

From the folder with `routines/` and `package.json`:

```bash
pnpm add kombinat
pnpm kombinat install
```

This writes `~/.config/systemd/user/kombinat.service`, or the same path under `$XDG_CONFIG_HOME`, then enables and starts the service. Run `install` again to restart the daemon with new settings. Run it in another folder to move the daemon there.

The service runs `kombinat serve` with the Node binary you installed with, in the project folder. Its `PATH` is the Node folder, the usual system folders and the `PATH` of the shell you install from. It also gets the `LANG`, `KOMBINAT_*`, `CLAUDE_BIN` and `CODEX_BIN` of that shell. systemd starts the daemon again 10 seconds after it stops. A restart stops only the daemon, not the routines that are running.

To see the unit: `systemctl --user cat kombinat.service`.

## Lingering

A user service runs only while you are logged in, unless lingering is on for your user. With lingering, the daemon keeps running after you log out and starts at boot without a login. `install` does not change this setting, but it tells you when lingering is off. To turn it on:

```bash
sudo loginctl enable-linger $USER
```

## Logs

The daemon appends its output to `~/.kombinat/daemon.log` and `~/.kombinat/daemon.err`, as on macOS. Run history is in `~/.kombinat/` too. `journalctl --user -u kombinat.service` shows when systemd started, stopped or restarted the daemon.

## Status

`pnpm kombinat status` shows the state of the service, then the state of the scheduler:

```
active state = active
sub state = running
main pid = 4242
restarts = 0
```

It shows `not loaded` when the service is not installed. `systemctl --user status kombinat.service` shows more.

## Uninstall

`pnpm kombinat uninstall` stops and disables the service and removes the unit file. Logs and run history stay in `~/.kombinat/`.

## Without systemd

Where systemd user services are not available, `install` stops with an error. Run the daemon in the foreground instead, and keep it running with your own supervisor, for example a Docker restart policy:

```bash
npx kombinat serve
```

Set `KOMBINAT_MANAGED=1` when a supervisor restarts it. The daemon then pulls the folder every 5 minutes and exits after a dependency update, as it does under systemd.

The dashboard listens on 127.0.0.1 only, so a published container port does not reach it.

## What was tested

The install was tested in Docker on Debian 12 with systemd 252, Node 24 and arm64, with `command` routines:

- `install`, `status` and `uninstall`;
- scheduled runs;
- systemd starts the daemon again after it is killed;
- a running routine finishes when the service restarts;
- with lingering, the daemon starts at boot without a login;
- the lingering message;
- a port set at install time, and moving the daemon to another folder;
- the free disk space and the CPU load in the daemon status;
- folders and variables with spaces, quotes, `%` and `$`;
- in containers without systemd, `install` fails with a message and `serve` works.

Not tested: Claude Code and Codex runs on Linux, because the test had no logged-in agents. Also not tested: other distributions, x86_64, WSL with systemd, and a session that ends with a real logout.
