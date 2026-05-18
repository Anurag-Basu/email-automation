const STOP = new Set(
  `a an the and or but if then else for on in at to from with as by of is are was were be been being it this that these those we you your our their they them will can could should would about into out up down over under between per all any some more most less few such than when where while how what who which also not no yes just like so than into only same than into out off than`.split(
    /\s+/,
  ),
);

/** Skip pathological "tokens" (e.g. huge unbroken strings) that break RegExp construction. */
const MAX_TOKEN_LEN = 48;

function tokenizeForTerms(text: string): string[] {
  const lower = text.toLowerCase();
  const raw = lower.match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  return raw.filter(
    (t) => !STOP.has(t) && t.length <= MAX_TOKEN_LEN && t.length >= 3,
  );
}

function termFrequency(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) {
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  return m;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rough keyword overlap: JD terms vs tailored resume (not a real ATS score). */
export type AtsKeywordHint = {
  coveragePercent: number;
  jdDistinctTermCount: number;
  matchedTerms: string[];
  missingTerms: string[];
};

const MAX_TERMS = 55;
const MAX_LIST = 28;

export function computeAtsKeywordHint(
  jobDescription: string,
  tailoredResume: string,
): AtsKeywordHint | null {
  const jdTokens = tokenizeForTerms(jobDescription);
  const freq = termFrequency(jdTokens);
  const distinct = [...freq.keys()].sort((a, b) => {
    const df = (freq.get(b) ?? 0) - (freq.get(a) ?? 0);
    if (df !== 0) return df;
    return b.length - a.length;
  });

  const terms = distinct.slice(0, MAX_TERMS);
  if (terms.length < 5) return null;

  const hay = tailoredResume.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const term of terms) {
    let found = false;
    try {
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      found = re.test(hay);
    } catch {
      found = hay.includes(term);
    }
    if (found) matched.push(term);
    else missing.push(term);
  }

  const coveragePercent = Math.round(
    (matched.length / Math.max(terms.length, 1)) * 100,
  );

  return {
    coveragePercent,
    jdDistinctTermCount: terms.length,
    matchedTerms: matched.slice(0, MAX_LIST),
    missingTerms: missing.slice(0, MAX_LIST),
  };
}
