# Worktrees

A routine that edits code works in its `cwd`, so it can change or commit work you have not finished there, and two such routines can get in each other's way. With `worktree: true`, each run gets a [git worktree](https://git-scm.com/docs/git-worktree) of its own instead:

```yaml
cwd: ~/Projects/app
worktree: true
before: pnpm install --frozen-lockfile
```

1. Before the run, Kombinat fetches the default branch of `origin`, the one `origin/HEAD` points to in a clone, and adds a worktree on a new branch from it, `kombinat/<routine>-<run id>`, in `~/.kombinat/worktrees/<routine>/<run id>`. When the fetch fails or takes more than 10 seconds, it starts from the branch as it was last fetched. A repository without `origin/HEAD` starts from the commit your checkout is on.
2. The agent and both hooks start in the worktree, in the same folder of the repository as `cwd`. A worktree holds only the files git tracks, so `before` is the place to install dependencies or copy a `.env`.
3. When the run ends, the run's page shows the branch, the folder and the files it changed. A run that changed and committed nothing takes its worktree and branch with it.

The `cwd` must be inside a git repository with at least one commit, or the run fails before its agent starts.

## Cleaning up

The run's page has Copy cd, to open the worktree in a terminal, and Remove worktree. Removing deletes the folder and keeps the branch, so its commits stay, and Copy git switch then gives you the command to check it out in your own checkout. A worktree with changes that are not committed is never removed: commit them first, or delete them with `git worktree remove --force <folder>`.

With a run retention set, a run that expires takes its worktree with it, unless the worktree has changes that are not committed. The branch stays.

## Continuing a run

A message to a finished run resumes its session in its worktree. If the worktree was removed, Kombinat adds it again on the run's branch first, without running `before`.
