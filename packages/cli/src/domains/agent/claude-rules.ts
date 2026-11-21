import path from 'node:path';

import { match, P } from 'ts-pattern';

import { checkIsRecord } from '../../utils/json';

interface ShellWord {
  text: string;
  isQuoted: boolean;
}

// Their second word is a noun and the third the verb, as in gh pr create.
const NOUN_VERB_COMMANDS = new Set(['gh', 'glab', 'gcloud', 'aws', 'az']);
// Claude Code runs these without asking in its working folders. Outside them it needs a Read rule.
const READ_ONLY_COMMANDS = new Set([
  'cd',
  'pwd',
  'echo',
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'rg',
  'wc',
  'sort',
  'uniq',
  'jq',
  'true',
  'false',
]);
const SUBCOMMAND = /^[a-z][a-z0-9-]*$/i;
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// How Claude Code says a command touched a path outside the working folders of the session.
const BLOCKED_PATH = /(\S+) in '([^']+)' (?:needs approval|was blocked)/;
const BLOCKED_PART = /requires approval: ([^\n]+)/;

// Splits a shell command into its simple commands, at ; & | newlines and parentheses outside quotes.
function splitCommands(command: string): ShellWord[][] {
  const commands: ShellWord[][] = [];
  let words: ShellWord[] = [];
  let word: ShellWord = { text: '', isQuoted: false };
  let quote: string | null = null;
  const endWord = () => {
    if (word.text !== '' || word.isQuoted) words.push(word);
    word = { text: '', isQuoted: false };
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };
  for (let index = 0; index < command.length; index += 1) {
    const char = command.charAt(index);
    const isRedirect =
      char === '&' && (/[<>]$/.test(word.text) || command.charAt(index + 1) === '>');
    if (quote !== null) {
      if (char === quote) quote = null;
      else word.text += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      word.isQuoted = true;
    } else if (char === '\\') {
      word.text += command.charAt(index + 1);
      word.isQuoted = true;
      index += 1;
    } else if (/[;&|\n()]/.test(char) && !isRedirect) {
      endCommand();
    } else if (/\s/.test(char)) {
      endWord();
    } else {
      word.text += char;
    }
  }
  endCommand();
  return commands;
}

function toCommandPrefix(words: ShellWord[]): string[] {
  const start = words.findIndex(word => !ASSIGNMENT.test(word.text));
  const [first, ...rest] = start === -1 ? [] : words.slice(start);
  if (first === undefined) return [];
  const length = NOUN_VERB_COMMANDS.has(first.text) ? 3 : 2;
  const prefix = [first.text];
  for (const word of rest) {
    if (prefix.length >= length || word.isQuoted || !SUBCOMMAND.test(word.text)) break;
    prefix.push(word.text);
  }
  return prefix;
}

// One rule per command that needs approval, such as Bash(git push *) for git push -u origin main.
function toBashRules(command: string): string[] {
  const prefixes = splitCommands(command)
    .map(toCommandPrefix)
    .filter(prefix => prefix.length > 0);
  const needApproval = prefixes.filter(([name = '']) => !READ_ONLY_COMMANDS.has(name));
  const rules = (needApproval.length > 0 ? needApproval : prefixes.slice(0, 1)).map(
    prefix => `Bash(${prefix.join(' ')} *)`,
  );
  return [...new Set(rules)];
}

// Absolute paths start with // in permission rules, since one / is relative to the settings file.
function toPathRule(tool: string, target: unknown, isFolder: boolean): string {
  if (typeof target !== 'string' || !path.isAbsolute(target)) return tool;
  const parent = path.dirname(target);
  const folder = isFolder || parent === path.parse(target).root ? target : parent;
  return `${tool}(/${path.join(folder, '**')})`;
}

function toPathTool(command: string): string {
  return READ_ONLY_COMMANDS.has(command) ? 'Read' : 'Edit';
}

// A command that reaches outside the working folders also needs a rule for the folder it reaches.
function toOutsidePathRules(reason: string | null): string[] {
  const blockedPath = reason === null ? null : BLOCKED_PATH.exec(reason);
  if (blockedPath) {
    const [, command = '', target = ''] = blockedPath;
    return [toPathRule(toPathTool(command), target, false)];
  }
  const part = reason === null ? undefined : BLOCKED_PART.exec(reason)?.[1];
  if (part === undefined) return [];
  return splitCommands(part).flatMap(words => {
    const [command = ''] = toCommandPrefix(words);
    return words
      .filter(word => path.isAbsolute(word.text))
      .map(word => toPathRule(toPathTool(command), word.text, false));
  });
}

function toDomainRule(url: unknown): string {
  const host = typeof url === 'string' ? URL.parse(url)?.hostname : undefined;
  return host ? `WebFetch(domain:${host})` : 'WebFetch';
}

// The rules for a Claude Code permissions.allow list that let the tool call through next time.
// The reason is the result Claude Code gave the agent for the denied call, when there is one.
export function suggestAllowRules(tool: string, input: unknown, reason: string | null): string[] {
  const fields = checkIsRecord(input) ? input : {};
  return match(tool)
    .with('Bash', () => {
      const command = fields['command'];
      const rules = typeof command === 'string' ? toBashRules(command) : [];
      return [
        ...new Set([...(rules.length > 0 ? rules : ['Bash']), ...toOutsidePathRules(reason)]),
      ];
    })
    .with(P.union('Edit', 'MultiEdit', 'Write', 'NotebookEdit'), () => [
      toPathRule('Edit', fields['file_path'] ?? fields['notebook_path'], false),
    ])
    .with('Read', () => [toPathRule('Read', fields['file_path'], false)])
    .with(P.union('Grep', 'Glob'), () => [toPathRule('Read', fields['path'], true)])
    .with('WebFetch', () => [toDomainRule(fields['url'])])
    .otherwise(() => [tool]);
}
