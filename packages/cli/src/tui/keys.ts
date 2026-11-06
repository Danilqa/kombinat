const CSI_KEYS: Record<string, string> = {
  A: 'up',
  B: 'down',
  C: 'right',
  D: 'left',
  H: 'home',
  F: 'end',
  Z: 'S-tab',
  '1~': 'home',
  '4~': 'end',
  '5~': 'pageup',
  '6~': 'pagedown',
  '7~': 'home',
  '8~': 'end',
  '200~': 'paste-start',
  '201~': 'paste-end',
};

const CONTROL_KEYS: Record<string, string> = {
  '\r': 'enter',
  '\n': 'enter',
  '\t': 'tab',
  '\x7f': 'backspace',
  '\b': 'backspace',
  ' ': 'space',
};

// Escape sequences from a key press arrive in one chunk, so an ESC that starts none is the Escape key.
export function parseKeys(chunk: string): string[] {
  const keys: string[] = [];
  let i = 0;
  while (i < chunk.length) {
    const char = chunk.charAt(i);
    if (char === '\x1b') {
      const sequence = /^\x1b(?:\[([0-9;]*)([A-Za-z~])|O([A-Za-z]))/.exec(chunk.slice(i));
      if (sequence) {
        const [whole, params = '', final, ss3] = sequence;
        // Modified keys like ctrl+up ("1;5A") are ignored.
        const code = ss3 ?? (final === '~' ? `${params}~` : params ? '' : (final ?? ''));
        const name = CSI_KEYS[code];
        if (name) keys.push(name);
        i += whole.length;
        continue;
      }
      // Nothing is bound to alt, so ESC and a key in one chunk (fast typing over ssh) are two presses.
      keys.push('escape');
      i += 1;
      continue;
    }
    const control = CONTROL_KEYS[char];
    if (control !== undefined) {
      keys.push(control);
    } else if (char < ' ') {
      keys.push(`C-${String.fromCharCode(char.charCodeAt(0) + 96)}`);
    } else {
      keys.push(char);
    }
    i += 1;
  }
  return keys;
}

// Drops bracketed pastes, so pasting "every" never presses r then y, and waits for cut-off escape sequences.
export function createKeyReader(): (chunk: string) => string[] {
  let isPasting = false;
  let pending = '';
  return chunk => {
    const input = pending + chunk;
    const cutOff = /\x1b(\[[0-9;]*|O)$/.exec(input);
    pending = cutOff ? cutOff[0] : '';
    return parseKeys(cutOff ? input.slice(0, cutOff.index) : input).filter(key => {
      if (key === 'paste-start') isPasting = true;
      else if (key === 'paste-end') isPasting = false;
      else return !isPasting;
      return false;
    });
  };
}
