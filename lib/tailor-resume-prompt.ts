/** Max chars of canonical resume injected into the tailor prompt (full file may be larger on disk). */
export const MAX_RESUME_CHARS_IN_TAILOR_PROMPT = 60_000;

/** JD slice size in the model prompt (request body may allow a longer paste). */
export const MAX_JD_CHARS_IN_TAILOR_PROMPT = 45_000;

/**
 * Build a Vertex prompt: canonical resume + JD → tailored Markdown resume.
 * Markdown improves preview (headings, links) and PDF rendering (sections, link annotations).
 * Name and contact are filled in by the app after generation — the model must not emit them.
 */
export function buildTailorResumePrompt(
  canonicalResume: string,
  jobDescription: string,
): string {
  const jdTrim = jobDescription.trim();
  const jdBlock =
    jdTrim.length > MAX_JD_CHARS_IN_TAILOR_PROMPT
      ? `${jdTrim.slice(0, MAX_JD_CHARS_IN_TAILOR_PROMPT)}\n\n[Job description truncated for model input; remainder omitted.]`
      : jdTrim;

  const resumeBlock =
    canonicalResume.length > MAX_RESUME_CHARS_IN_TAILOR_PROMPT
      ? `${canonicalResume.slice(0, MAX_RESUME_CHARS_IN_TAILOR_PROMPT)}\n\n[Resume text truncated for model input; remaining lines omitted.]`
      : canonicalResume;

  return `You are an expert resume editor for ATS (applicant tracking systems) and human recruiters. Produce a JOB-TAILORED resume as **GitHub-flavored Markdown** that maximizes HONEST overlap with the job description.

Output format (required):
- Do NOT output the candidate's name, phone, email, LinkedIn, GitHub, or any contact details. Do NOT use level-1 headings (\`#\`). The application prepends the header separately.
- Start the document with section headings only: \`## Section Name\` (level 2). Good first sections: \`## Professional Summary\` or \`## Profile\`, then \`## Work Experience\`, \`## Education\`, \`## Technical Skills\` or \`## Skills\`.
- Use \`-\` or \`*\` for bullet lists. For achievements under a client or role, use **nested** bullets (indent each nested line with two spaces) so bullets clearly sit under that client line.
- Work experience lines — mirror CANONICAL_RESUME’s structure:
  - **Consulting / agency pattern (preferred when CANONICAL_RESUME groups clients under one employer):** Put the **legal employer** on its own line. Wrap the **entire** employer line in Markdown bold so it prints distinctly in PDF: \`**Codevyasa ( Feb 2025 - Present )**\` — include the parenthetical dates **inside** the bold when CANONICAL_RESUME has that span on the **employer** line (never invent). If there is no date for the employer stint, use \`**Codevyasa**\` only.
  - Then each **client / engagement**: a bullet line with the **full** client title (client + role in parentheses) wrapped in \`**...\`**, e.g. \`- **Paytm ( SDE-2 )**\` and \`- **Bharatpe ( SDE-2 )**\`. Use the same pattern for **every** sibling client. **No** dates on client lines unless CANONICAL_RESUME dates that specific client — never copy the parent employer’s dates onto client lines.
  - Under each client line, add 2–6 **nested** achievement bullets (\`  - ...\` with two leading spaces).
- **Single company (not multi-client):** one bold title line including company **and** dates when the source has them, e.g. \`**Dataslush Full-Stack Developer (Gen AI) ( Oct 2023 - Oct 2024 )**\`, matching CANONICAL_RESUME.
- Skills: a \`##\` heading plus a bullet list or comma-rich paragraph as you prefer.
- Do NOT wrap the entire resume in a fenced code block (\`\`\`). No HTML. No CSS.

Dates and employment timespans (strict):
- For **each** distinct job, client, or engagement block, you may use month/year ranges, years, or the word \`Present\` **only** when they appear in CANONICAL_RESUME **for that same block** (same employer + same client/product context). Copy them faithfully; do not reformat into a range that was not there unless it is clearly the same facts (e.g. "Feb 2025" vs "February 2025" is fine).
- If CANONICAL_RESUME gives **no** dates for a given **client** block, that client line must have **no** dates — do **not** reuse the parent employer’s dates, another client’s dates, or invent ranges.

Staffing / consultancies — multiple clients under one employer:
- When CANONICAL_RESUME lists one employer then multiple clients, **keep that hierarchy**: parent **employer** line (entire line bold, dates on parent only if the source does), then one \`- **Client ( title )**\` bullet per client with **nested** bullets under each.
- Do **not** flatten into a single bold line per client like \`**Codevyasa — SDE-2 @ Paytm (dates…)**\` when the source used employer-on-top + sub-clients — match the candidate’s layout.
- If CANONICAL_RESUME uses a flat one-line-per-role style for every job, mirror that instead (do not invent the parent/sub pattern).

Truth and ethics (non-negotiable):
- Use ONLY employers, dates, titles, degrees, certifications, tools, and outcomes that appear in CANONICAL_RESUME or are direct paraphrases of the same fact. Never invent companies, degrees, metrics, years, URLs, or technologies. **Never invent or duplicate dates across roles.**
- Do not guess LinkedIn/GitHub or other URLs; you are not emitting contact in this output anyway.
- If the JD asks for something not in the resume, do NOT claim it.

ATS and keyword strategy (within the truth constraint):
1) Extract important multi-word phrases from JOB_DESCRIPTION. Where the candidate clearly has equivalent experience in CANONICAL_RESUME, prefer the JD's EXACT wording (or standard variants: "JavaScript" / "JS", "REST" / "RESTful APIs") in bullets and summary.
2) Place the strongest JD-aligned terms early: Professional Summary and the first bullet under the most recent relevant role.
3) Work Experience: follow CANONICAL_RESUME order and nesting (consultancy parent + clients + nested bullets, or flat roles). Reverse-chronological when the source implies it; do not invent ordering dates. Do not invent metrics.
4) Skills: include every honest tool from CANONICAL_RESUME that overlaps the JD; JD-mentioned skills first.

Do not add a cover letter, salutation, or commentary about "ATS" or "optimization." No preamble or postscript after the resume.

JOB_DESCRIPTION:
---
${jdBlock}
---

CANONICAL_RESUME:
---
${resumeBlock.trim()}
---

Output the full tailored resume body as Markdown only (sections starting with \`##\`, no \`#\` headings).`;
}
