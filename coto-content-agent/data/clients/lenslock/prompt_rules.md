# Revision Prompt Rules

Every image gets its own dedicated revision prompt.

Prompt must include:

- image id
- source image path
- target output path
- exact edits requested
- what must stay unchanged
- logo preservation rules
- text preservation rules
- dimension / aspect ratio requirement
- reference asset paths if needed
- negative constraints
- QA checklist

## Required language (use verbatim where applicable)

- "Preserve exact aspect ratio and dimensions."
- "Preserve all wording exactly unless explicitly instructed otherwise."
- "Preserve the LensLock logo exactly with no distortion, recoloring, redraw, drift, glow, or added marks."
- "Make only the requested changes."
- "If any requested edit conflicts with logo/text preservation, prioritize preservation and flag for review."
