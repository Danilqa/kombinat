import { routineTemplateIdSchema, type RoutineTemplateId } from './ids';
import type { RoutineTemplate, RoutineTemplateCategory, RoutineTemplateNeed } from './types';

export const ROUTINE_TEMPLATE_CATEGORIES: RoutineTemplateCategory[] = [
  'code',
  'watch',
  'reports',
  'home',
];

const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';
const REPOSITORY_HINT = 'The git repository the agent works in';
const GITHUB_REPOSITORY: RoutineTemplateNeed[] = ['git-repository', 'github-cli'];

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: routineTemplateIdSchema.parse('review-pull-requests'),
    category: 'code',
    title: 'Review pull requests that wait for you',
    description: 'A review comment on every pull request that asks for yours',
    needs: GITHUB_REPOSITORY,
    schedule: '15 9-17/2 * * *',
    cwd: '',
    folderHint: REPOSITORY_HINT,
    agent: 'claude',
    model: SONNET,
    effort: 'high',
    permissionMode: 'auto',
    timeoutMinutes: 30,
    retries: 1,
    worktree: true,
    memory: false,
    check: `test -n "$(gh pr list --search 'review-requested:@me' --json number --jq '.[].number')" || exit 78`,
    prompt: `List the open pull requests that request my review: \`gh pr list --search "review-requested:@me"\`.

For each one, read its description and its diff with \`gh pr diff <number>\`, and check out its branch when you need more context.

Leave one review as a comment with \`gh pr review <number> --comment --body-file <file>\`: what the change does in one line, then the bugs, risks and missing tests you found, each with the file and line. Never approve and never request changes: I make the final call.

End with one line per pull request: its number, its title and what you found. If no pull request waits for me, answer only "No pull requests to review."`,
  },
  {
    id: routineTemplateIdSchema.parse('work-on-agent-issues'),
    category: 'code',
    title: 'Work on issues labelled agent',
    description: 'A draft pull request for the oldest open issue labelled agent',
    needs: GITHUB_REPOSITORY,
    schedule: '0 2 * * *',
    cwd: '',
    folderHint: REPOSITORY_HINT,
    agent: 'claude',
    model: SONNET,
    effort: 'high',
    permissionMode: 'auto',
    timeoutMinutes: 55,
    retries: 1,
    worktree: true,
    memory: false,
    check: `test -n "$(gh issue list --label agent --state open --json number --jq '.[].number')" || exit 78`,
    prompt: `Pick the oldest open issue labelled \`agent\` that no open pull request mentions: \`gh issue list --label agent --state open\`.

Read the issue with its comments. If it isn't clear what to build, leave one comment with your question and stop: nobody can answer you during this run.

Otherwise, build it on a new branch. Follow the project's README and contributing guide, keep the change small and add tests the way the project already tests the same code. Run the project's checks and fix what they report.

Push the branch and open a draft pull request that says "Closes #<number>" and lists what you changed. Answer with the link. If no issue is left, answer only "No issues to work on."`,
  },
  {
    id: routineTemplateIdSchema.parse('remove-dead-code'),
    category: 'code',
    title: 'Clean up dead code',
    description: 'A weekly pull request that deletes code nothing uses',
    needs: GITHUB_REPOSITORY,
    schedule: '0 10 * * 1',
    cwd: '',
    folderHint: REPOSITORY_HINT,
    agent: 'claude',
    model: SONNET,
    effort: 'high',
    permissionMode: 'auto',
    timeoutMinutes: 45,
    retries: 1,
    worktree: true,
    memory: false,
    check: null,
    prompt: `Find code that nothing uses: files no one imports, exports no one reads and functions no one calls. Use the project's own tools for it when it has them, such as knip or ts-prune, and confirm each finding with a search.

Delete only what is certainly unused. Leave public APIs, entry points, scripts and anything loaded by name alone.

Run the project's checks and fix what they report. Then push a new branch and open a draft pull request that lists what you removed and how you checked it. Answer with the link. If you found nothing to remove, answer only "Nothing to remove."`,
  },
  {
    id: routineTemplateIdSchema.parse('watch-ci-on-main'),
    category: 'watch',
    title: 'Watch CI on main',
    description: 'A note when main goes red, with the commit that broke it',
    needs: GITHUB_REPOSITORY,
    schedule: '*/30 * * * *',
    cwd: '',
    folderHint: REPOSITORY_HINT,
    agent: 'claude',
    model: HAIKU,
    effort: 'low',
    permissionMode: 'auto',
    timeoutMinutes: 10,
    retries: 0,
    worktree: false,
    memory: true,
    check: `gh run list --branch main --limit 1 --json conclusion,updatedAt --jq '.[0] | select(.conclusion == "failure" and (.updatedAt | fromdate) > now - 3600)' | grep -q . || exit 78`,
    prompt: `The latest workflow run on main failed. Find it with \`gh run list --branch main --limit 5\` and read why with \`gh run view <id> --log-failed\`.

If your memory says you already reported this run, answer only "No new failures."

Otherwise, answer in three lines at most: which job and step failed, the error, and the commit that most likely broke it, with its author. Keep the run's id in memory.`,
  },
  {
    id: routineTemplateIdSchema.parse('watch-dependency-advisories'),
    category: 'watch',
    title: 'Watch dependencies for security advisories',
    description: 'A note when a dependency gets a known vulnerability',
    needs: ['git-repository'],
    schedule: '0 9 * * *',
    cwd: '',
    folderHint: 'A project with a lockfile, such as package-lock.json',
    agent: 'claude',
    model: HAIKU,
    effort: 'low',
    permissionMode: 'auto',
    timeoutMinutes: 10,
    retries: 0,
    worktree: false,
    memory: true,
    check: null,
    prompt: `Run the security audit of this project's package manager, the one its lockfile belongs to, such as \`npm audit\`, \`pnpm audit\` or \`yarn npm audit\`. Change nothing.

Keep only the high and critical advisories that your memory doesn't list yet. For each, write one line: the package, the advisory, and the version that fixes it.

Keep every advisory you reported in memory. If there are no new ones, answer only "No new advisories."`,
  },
  {
    id: routineTemplateIdSchema.parse('sum-up-commits'),
    category: 'reports',
    title: "Sum up yesterday's commits",
    description: 'A short note on what changed in the repository in the last day',
    needs: ['git-repository'],
    schedule: '0 9 * * 1-5',
    cwd: '',
    folderHint: REPOSITORY_HINT,
    agent: 'claude',
    model: HAIKU,
    effort: 'low',
    permissionMode: 'auto',
    timeoutMinutes: 10,
    retries: 0,
    worktree: false,
    memory: false,
    check: null,
    prompt: `Fetch the remote with \`git fetch\`, then read the commits of the default branch from the last 24 hours, or since Friday morning when today is Monday.

Sum them up in at most five bullets, grouped by what they change, with the authors' names. Mention anything risky, such as a migration, a removed feature or a dependency update.

If there are no commits, answer only "No commits since the last summary."`,
  },
  {
    id: routineTemplateIdSchema.parse('weekly-shipped-recap'),
    category: 'reports',
    title: 'Recap what shipped this week',
    description: 'A Friday summary of the merged pull requests, grouped by theme',
    needs: GITHUB_REPOSITORY,
    schedule: '0 16 * * 5',
    cwd: '',
    folderHint: REPOSITORY_HINT,
    agent: 'claude',
    model: HAIKU,
    effort: 'low',
    permissionMode: 'auto',
    timeoutMinutes: 10,
    retries: 0,
    worktree: false,
    memory: false,
    check: null,
    prompt: `List the pull requests merged in the last 7 days: \`gh pr list --state merged --search "merged:>=<date a week ago>" --limit 100\`.

Group them by theme, such as features, fixes and maintenance. Write one line per pull request with its number and what it changes for the people who use the project, not how.

Start with one sentence on the week as a whole. If nothing was merged, answer only "Nothing shipped this week."`,
  },
  {
    id: routineTemplateIdSchema.parse('umbrella-check'),
    category: 'home',
    title: 'Say if you need an umbrella',
    description: 'One line each weekday morning, from the forecast',
    needs: [],
    schedule: '0 8 * * 1-5',
    cwd: '~/',
    folderHint: 'Where the agent works',
    agent: 'claude',
    model: HAIKU,
    effort: 'low',
    permissionMode: 'auto',
    timeoutMinutes: 5,
    retries: 0,
    worktree: false,
    memory: false,
    check: null,
    prompt: `Check today's weather forecast for where I am. wttr.in works without an API key.

Answer in one short line: do I need an umbrella today, and why.`,
  },
  {
    id: routineTemplateIdSchema.parse('tidy-downloads'),
    category: 'home',
    title: 'Tidy up the Downloads folder',
    description: 'A weekly list of old downloads you can delete',
    needs: [],
    schedule: '0 18 * * 0',
    cwd: '~/Downloads',
    folderHint: 'The folder to look through',
    agent: 'claude',
    model: HAIKU,
    effort: 'low',
    permissionMode: 'auto',
    timeoutMinutes: 5,
    retries: 0,
    worktree: false,
    memory: false,
    check: null,
    prompt: `List the files in this folder that are older than 30 days. Never delete, move or open any of them.

Answer with the 15 largest, biggest first, one line each with its name, size and age, then the total size of all old files.

If no file is older than 30 days, answer only "Nothing to tidy up."`,
  },
];

export function findRoutineTemplate(id: RoutineTemplateId): RoutineTemplate | null {
  return ROUTINE_TEMPLATES.find(template => template.id === id) ?? null;
}
