/**
 * A deliberately small TeX renderer. The lab ships offline as a single file, so
 * pulling in KaTeX is not an option; the formulae used across CBSE Class XII are
 * covered by fractions, super/subscripts, roots, and the Greek alphabet.
 */
const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε',
  varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ', iota: 'ι',
  kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'µ', nu: 'ν', xi: 'ξ', pi: 'π',
  Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  Phi: 'Φ', chi: 'χ', psi: 'ψ', Psi: 'Ψ', omega: 'ω', Omega: 'Ω',
  infty: '∞', times: '×', cdot: '·', pm: '±', mp: '∓', approx: '≈',
  neq: '≠', leq: '≤', geq: '≥', to: '→', rightarrow: '→', propto: '∝',
  partial: '∂', nabla: '∇', int: '∫', sum: '∑', hbar: 'ℏ', degree: '°',
  circ: '°', ell: 'ℓ', prime: '′', left: '', right: '', quad: ' ', ',': ' '
};

type Node = { type: 'text'; value: string } | { type: 'frac'; num: Node[]; den: Node[] } | { type: 'sup'; body: Node[] } | { type: 'sub'; body: Node[] } | { type: 'sqrt'; body: Node[] };

function readGroup(src: string, i: number): { body: string; next: number } {
  if (src[i] !== '{') {
    // A bare token: a single character, or a command like \alpha.
    if (src[i] === '\\') {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j += 1;
      return { body: src.slice(i, j), next: j };
    }
    return { body: src[i] ?? '', next: i + 1 };
  }
  let depth = 0;
  for (let j = i; j < src.length; j += 1) {
    if (src[j] === '{') depth += 1;
    else if (src[j] === '}') {
      depth -= 1;
      if (depth === 0) return { body: src.slice(i + 1, j), next: j + 1 };
    }
  }
  return { body: src.slice(i + 1), next: src.length };
}

function parse(src: string): Node[] {
  const out: Node[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ type: 'text', value: text });
    text = '';
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j += 1;
      const cmd = src.slice(i + 1, j) || src[i + 1];
      if (cmd === 'frac') {
        flush();
        const a = readGroup(src, j);
        const b = readGroup(src, a.next);
        out.push({ type: 'frac', num: parse(a.body), den: parse(b.body) });
        i = b.next;
        continue;
      }
      if (cmd === 'sqrt') {
        flush();
        const a = readGroup(src, j);
        out.push({ type: 'sqrt', body: parse(a.body) });
        i = a.next;
        continue;
      }
      if (cmd in GREEK) {
        text += GREEK[cmd];
        i = j;
        continue;
      }
      text += cmd;
      i = j > i + 1 ? j : i + 2;
      continue;
    }
    if (ch === '^' || ch === '_') {
      flush();
      const g = readGroup(src, i + 1);
      const body = parse(g.body);
      out.push(ch === '^' ? { type: 'sup', body } : { type: 'sub', body });
      i = g.next;
      continue;
    }
    if (ch === '{' || ch === '}') {
      i += 1;
      continue;
    }
    text += ch;
    i += 1;
  }
  flush();
  return out;
}

function render(nodes: Node[], keyPrefix = 'n'): React.ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${keyPrefix}-${i}`;
    switch (n.type) {
      case 'text':
        return <span key={k}>{n.value}</span>;
      case 'sup':
        return <sup key={k}>{render(n.body, k)}</sup>;
      case 'sub':
        return <sub key={k}>{render(n.body, k)}</sub>;
      case 'sqrt':
        return (
          <span key={k} className="tex-sqrt">
            <span aria-hidden="true">√</span>
            <span className="tex-sqrt-body">{render(n.body, k)}</span>
          </span>
        );
      case 'frac':
        return (
          <span key={k} className="tex-frac">
            <span className="tex-num">{render(n.num, `${k}n`)}</span>
            <span className="tex-den">{render(n.den, `${k}d`)}</span>
          </span>
        );
      default:
        return null;
    }
  });
}

/** Renders a TeX fragment as accessible inline markup. */
export function Tex({ children, block = false }: { children: string; block?: boolean }) {
  const nodes = parse(children);
  return (
    <span className={block ? 'tex tex-block' : 'tex'} role="math" aria-label={plain(children)}>
      {render(nodes)}
    </span>
  );
}

/** A screen-reader friendly flattening of the same source. */
function plain(src: string): string {
  return src
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1) over ($2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, 'square root of ($1)')
    .replace(/\\([a-zA-Z]+)/g, (_, w: string) => GREEK[w] ?? w)
    .replace(/[{}]/g, '')
    .replace(/\^/g, ' to the power ')
    .replace(/_/g, ' sub ');
}
