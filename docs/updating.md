# Updating

## Your routines

The daemon runs `git pull` in its folder every 5 minutes, so merged changes go live on their own. It pulls only when the checkout is on `main` and has no local changes.

## Kombinat

To update Kombinat, bump `kombinat` in `package.json`, for example with a Renovate or Dependabot PR.

When the lockfile changes, the daemon installs dependencies with pnpm, npm or Yarn, then restarts. Running routines are not interrupted.

## New versions

When a new version is out, the dashboard shows a card in the bottom left corner with the changelog and the command to update. The terminal dashboard shows it in its bottom bar.

If you close the card, it stays hidden until a newer version comes out.

## From @danilqa/kombinat

Up to 0.2.2, Kombinat was published as `@danilqa/kombinat`. To move to `kombinat`:

1. Replace the dependency in `package.json`.
2. Install it.
3. Run `pnpm kombinat install` again.

Until you run `install` again, the daemon's launchd job points into the old package folder, which the install removes. The daemon then misses the new version and doesn't start after a reboot.
