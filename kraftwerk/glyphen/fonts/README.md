# Glyphen / AzBuk

`build-fonts.py` builds the three existing font assets directly from
`Zerkalius-azbuk.html`: `BASE.thin` supplies the masks and `DESCEND` supplies
the baseline offsets. There is no separate editable copy of the alphabet.
Browser-local edits in `azbuk-edits-v2` are not part of the published source.

From this directory, install `fonttools` and `brotli`, then run:

```powershell
python -m pip install fonttools brotli
python build-fonts.py
```

The fonts retain the square geometry of Glyphen's original TTFs: 128 units per
cell, 1024 units per em, one cell of inter-letter spacing. Thin is proportional.
Mono retains the search field's existing contract: digits and spaces have the
same 768-unit advance; other characters retain Thin's advances. The two family
names are `AzBuk Thin` and `AzBuk Mono`.

Descenders now follow the current AzBuk baseline instead of moving their entire
bodies upward. Font ascent/descent reserve these rows while keeping the previous
1280-unit total line height. Punctuation uses the source's seven-row positions.
The source version and mask digest are embedded in the font names for provenance;
timestamps are fixed so unchanged inputs produce reproducible files.

Generation is an asset build. Tests, syntax checks, browser runs and visual
acceptance are left to the user under the current project instructions.
