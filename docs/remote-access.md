# Remote access

The dashboard listens only on localhost. To open it from another device, use SSH or Tailscale Serve.

## Over SSH

1. On the Mac that runs Kombinat, turn on Remote Login in System Settings → General → Sharing.
2. On your laptop, run:

   ```bash
   npx kombinat connect admin@mac-mini         # dashboard in the browser
   npx kombinat connect admin@mac-mini --tui   # dashboard in the terminal
   ```

`connect` opens an SSH tunnel to the daemon and then opens the dashboard. Press Ctrl-C to disconnect.

- If you have no SSH key set up, SSH asks for your password.
- Instead of `admin@mac-mini`, you can use anything `ssh` accepts: a host from `~/.ssh/config`, an IP address or a Tailscale machine name.
- If the daemon there uses another `KOMBINAT_PORT`, add `--port` with that port.

You can also ssh in and run `pnpm kombinat tui` in the folder Kombinat runs in.

## With Tailscale Serve

Tailscale Serve opens the dashboard to every device in your tailnet, including your phone. On the Mac that runs Kombinat, run:

```bash
tailscale serve --bg 7433
```

The dashboard is then at `https://mac-mini.<your-tailnet>.ts.net`. To open it in the terminal, run `npx kombinat tui --url https://mac-mini.<your-tailnet>.ts.net`.

- Serve needs HTTPS certificates in your tailnet, and the command asks you to turn them on. Your machine name then shows up in public certificate logs.
- Serve stays on after a reboot. To turn it off, run `tailscale serve --https=443 off`.
- If the Mac has no `tailscale` command, see [Using the Tailscale CLI](https://tailscale.com/kb/1080/cli).

### Who can use it

Anyone in your tailnet who can reach the Mac can read transcripts, start routines and message their agents. They can also run any prompt they write with a routine's agent, folder and permissions, and allow the actions a run was blocked from for one reply.

To limit this, let only some people reach port 443 of the Mac in your [Tailscale access rules](https://tailscale.com/kb/1018/acls).
