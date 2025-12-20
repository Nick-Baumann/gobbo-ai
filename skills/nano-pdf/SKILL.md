---
name: nano-pdf
description: Edit PDFs with natural-language instructions using the nano-pdf CLI.
metadata: {"clawdis":{"requires":{"bins":["nano-pdf"]},"install":[{"id":"pipx","kind":"shell","command":"python3 -m pip install --user pipx && python3 -m pipx ensurepath && pipx install nano-pdf","bins":["nano-pdf"],"label":"Install nano-pdf (pipx)"},{"id":"pip","kind":"shell","command":"python3 -m pip install --user nano-pdf","bins":["nano-pdf"],"label":"Install nano-pdf (pip --user)"}]}}
---

# nano-pdf

Use `nano-pdf` to apply edits to a specific page in a PDF using a natural-language instruction.

## Quick start

```bash
nano-pdf edit deck.pdf 1 "Change the title to 'Q3 Results' and fix the typo in the subtitle"
```

Notes:
- Page numbers are 0-based or 1-based depending on the tool’s version/config; if the result looks off by one, retry with the other.
- Always sanity-check the output PDF before sending it out.
