# Unslop: AI patterns to detect and fix

Adapted from the cursor/plugins unslop skill. Scan for these patterns,
rewrite to preserve meaning and match the intended tone, then add human
voice (see the main SKILL.md). This applies to every piece of writing in
the vault.

## Content

1. **Significance inflation.** "pivotal moment", "testament to",
   "evolving landscape", "setting the stage for", "indelible mark",
   "deeply rooted". Cut the puffery and state what happened.
2. **Notability name-dropping.** Listing outlets or names without
   context. Pick one and say what it actually said.
3. **Superficial -ing phrases.** "highlighting...", "ensuring...",
   "reflecting...", "showcasing...", "fostering...". Delete, or expand
   with a real source.
4. **Promotional language.** "nestled", "vibrant", "breathtaking",
   "groundbreaking", "renowned", "stunning", "must-visit". Use neutral
   description.
5. **Vague attribution.** "Experts believe", "Industry reports
   suggest", "Some critics argue". Name the source or delete the claim.
6. **Formulaic challenge framing.** "Despite challenges, X continues to
   thrive." Replace with specific facts.

## Language

7. **AI vocabulary.** additionally, crucial, delve, enduring, enhance,
   fostering, garner, interplay, intricate, landscape (abstract),
   pivotal, showcase, tapestry (abstract), testament, underscore,
   vibrant. Replace with plain words.
8. **Copula avoidance.** "serves as", "stands as", "boasts",
   "features". Just write "is" or "has".
9. **Negative parallelism.** "It's not just X, it's Y." State the point
   directly.
10. **Forced rule of three.** Cramming ideas into groups of three. Use
    the natural number.
11. **Synonym cycling.** protagonist / main character / central figure /
    hero in one paragraph. Pick one term and repeat it.
12. **False ranges.** "from X to Y" where X and Y aren't on a real
    scale. List the items directly.

## Style

13. **Em dash overuse.** Avoid em dashes entirely. Use periods or
    commas. Don't swap in parentheses or en dashes, that just trades one
    tell for another. If a thought needs separation, end the sentence.
14. **Colon overuse.** Colons are fine before a list or example, not as
    mid-sentence connectors. Rewrite so the point stands on its own.
15. **Boldface overuse.** Don't bold every proper noun or acronym.
16. **Inline-header lists.** The tell is a bold label plus colon that
    restates the line ("**Performance:** Performance improved..."). Turn
    those into prose. A bold lead-in that ends in a period, names the
    item, and is followed by genuinely new detail
    ("**Schema in TypeScript.** Tables live in one file.") is fine.
17. **Title case headings.** Use sentence case.
18. **Decorative emoji.** Remove from headings and bullets.
19. **Curly quotes.** Replace with straight quotes.

## Communication artifacts

20. **Chatbot phrases.** "I hope this helps!", "Let me know if...",
    "Of course!", "Certainly!", "Found the smoking gun!" Remove.
21. **Cutoff disclaimers.** "While specific details are limited..."
    Find the source or drop it.
22. **Sycophantic tone.** "Great question!", "You're absolutely right!"
    Respond directly instead.

## Filler

23. **Filler phrases.** "in order to" becomes "to". "due to the fact
    that" becomes "because". "it is important to note that" gets
    deleted.
24. **Excessive hedging.** "could potentially possibly be argued that it
    might" becomes "may".
25. **Generic conclusions.** "The future looks bright." State a
    specific plan or fact.

## Jargon

26. **Abstract metaphor nouns.** substrate, wedge, vector, locus,
    vantage, nexus, primitive (as noun), harness (as metaphor), surface
    (as in "API surface"), bedrock, scaffolding (as metaphor),
    modality, paradigm, gold-plating. Most have a plainer concrete word.
    "substrate" to "base", "wedge in" to "add", "vector" to "way" or
    "method", "gold-plating" to "more than the job needs".

## Plain speech

27. **Say the concrete thing.** Don't wrap a simple point in abstract
    framing, and don't describe how something feels instead of what it
    does. Name the mechanism, a fact, or a number. If you can't restate
    it as a concrete instruction, fact, or number, cut it.
28. **Shorten or split dense sentences.** If the reader has to backtrack
    to parse a sentence, break it in two or drop clauses. One idea per
    sentence.
29. **Active voice.** Catch "is/are/was/were + past participle" and name
    the actor. "queries are validated" becomes "the compiler validates
    queries". Passive is fine only when the actor is unknown or truly
    doesn't matter.
30. **Cut adverbs, or use a stronger verb.** "runs quickly" becomes "is
    fast" or the number. "significantly improves" becomes the measured
    delta. An adverb propping up a weak verb means the verb is wrong.
31. **Prefer the plain word.** "utilize" to "use", "leverage" to "use",
    "facilitate" to "help", "numerous" to "many", "in the event that"
    to "if". The fancier synonym is rarely clearer.
