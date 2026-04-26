/**
 * 경량 glob 매처 — 의존성 추가 회피용. 지원: * ** ? {a,b}
 * 외부 minimatch 패키지를 쓰면 더 정확하지만, MVP는 자체 구현으로 충분.
 */

export function minimatch(filePath: string, pattern: string): boolean {
  // 입력 정규화 (윈도우 \ → /)
  const p = filePath.replace(/\\/g, "/");
  const rx = globToRegex(pattern);
  return rx.test(p);
}

function globToRegex(glob: string): RegExp {
  // 1) {a,b,c} 확장
  const expanded = expandBraces(glob);
  // 2) 각 브랜치를 정규식으로 변환 후 union
  const parts = expanded.map((g) => `^${segmentToRegex(g)}$`);
  return new RegExp(parts.join("|"));
}

function expandBraces(glob: string): string[] {
  const m = glob.match(/^([^{]*)\{([^}]+)\}(.*)$/);
  if (!m) return [glob];
  const [, prefix, opts, suffix] = m;
  return opts.split(",").flatMap((opt) => expandBraces(prefix + opt + suffix));
}

function segmentToRegex(glob: string): string {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** = match across path separators
        out += ".*";
        i++;
        // skip following / if present
        if (glob[i + 1] === "/") i++;
      } else {
        // single * = no /
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else if (".+^$()|\\".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }
  return out;
}
