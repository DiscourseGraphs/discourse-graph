---
name: tech-writing
description: "House writing style for everything produced in this vault. Apply to ALL prose Claude writes here, including chat responses, artifacts, documents, and the body text of other skills. Combines the Google developer documentation style guide (clarity, voice, formatting) with unslop rules that strip AI tells and add human voice. Trigger this on every writing or editing task, even when the user doesn't name a style, and consult it before drafting reports, guides, READMEs, explanations, or any user-facing text. When in doubt, apply it."
---

# Tech writing style

This is the house style for all writing in the vault. It has two jobs:
make text clear and consistent (Google developer style), and make it
read like a person wrote it, not a model (unslop). Apply both to chat
responses, artifacts, documents, and the prose inside other skills.

## How to use this skill

1. Draft the content normally.
2. Run the quick checklist below. Fix anything it flags.
3. For a close edit, work through `references/unslop.md` pattern by
   pattern, then `references/google-style.md` for grammar and
   formatting questions.
4. Self-audit last: ask "what makes this obviously AI generated?" and
   fix what remains.

These are guidelines, not laws. Depart from any of them when doing so
makes the text clearer for the reader. When you depart, stay
consistent within the document.

## Quick checklist

Voice and clarity:

- Write in second person ("you"), not "we", when addressing the reader.
- Use active voice. Name who does the action. "The compiler validates
  the query", not "the query is validated".
- Present tense for how things behave. "The function returns", not
  "the function will return".
- Put the condition before the instruction. "To save the file, press
  Enter", or "If the build fails, check the log", not the reverse.
- One idea per sentence. Split anything the reader has to reread.
- Be conversational without being frivolous. No filler, no hype.

Kill the AI tells (full list in `references/unslop.md`):

- No em dashes. End the sentence or use a comma.
- No significance inflation: "pivotal", "testament to", "landscape",
  "underscore", "showcase", "vibrant", "tapestry", "delve".
- No copula avoidance. Write "is" and "has", not "serves as",
  "boasts", "stands as".
- No negative parallelism. State the point, not "it's not just X,
  it's Y".
- No vague attribution. Name the source or cut the claim.
- No chatbot filler. Drop "Great question", "I hope this helps",
  "Certainly!", "Let me know if...".
- No forced rule of three. Use the natural number of items.
- Cut filler phrases: "in order to" to "to", "due to the fact that"
  to "because", delete "it is important to note that".
- Prefer the plain word: "use" not "utilize" or "leverage", "help"
  not "facilitate", "many" not "numerous".

Formatting (details in `references/google-style.md`):

- Sentence case for titles and headings, not Title Case.
- Numbered lists for sequences, bulleted lists for everything else.
- Serial (Oxford) comma.
- Code font for code, filenames, and literal values.
- Bold for UI element names the user clicks.
- Straight quotes, not curly. Standard American spelling.
- No decorative emoji in headings or bullets.
- Descriptive link text. Never "click here".
- Don't over-bold. Don't put a bold label and colon in front of a
  line that just restates the label.

## Add human voice

Removing patterns is only half the job. Voiceless, sterile text is its
own tell. So:

- Have a view. React to the facts instead of listing neutral pros and
  cons.
- Vary the rhythm. Short sentences. Then a longer one that takes its
  time. Mix them.
- Be concrete. Name the mechanism, the number, or the outcome, not the
  feeling. "A column rename fails the build" beats "types that follow
  your schema".
- Use "I" when it fits. First person isn't unprofessional.
- Let a little mess in. Flawless parallel structure reads as
  algorithmic.

## Reference files

Read these for a thorough pass or when a specific question comes up:

- `references/unslop.md` — the full list of AI patterns to detect and
  fix, grouped by content, language, style, and filler. Use it for a
  line edit.
- `references/google-style.md` — grammar, punctuation, formatting, and
  voice rules from the Google developer documentation style guide, plus
  its reference hierarchy for questions this skill doesn't cover.

## Scope note

When writing or editing another skill in this vault, apply this style
to that skill's instructional prose too, so the whole vault reads in
one consistent voice. The one exception is verbatim quotes, code, and
fixed API strings, leave those exactly as they are.
