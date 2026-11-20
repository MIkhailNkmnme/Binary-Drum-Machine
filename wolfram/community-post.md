# Sequential XOR patterns in Zerkalius: a moving-cone pendulum and two Animatrix rules

Draft v0.002 for Wolfram Community · 20 November 2026. Prepared for author review; not submitted to the forum. User-selected project figures are reused unchanged; the point-axis GIF is a format conversion of the complete existing MP4. The implementation is JavaScript; the mathematical connection to NKS is the subject of this discussion.

---

I am developing **Zerkalius**, a visual project exploring how simple rules produce structured patterns. I would like to share a comparison with *A New Kind of Science* and ask for references to closely related systems.

The images initially drew my attention, but the main question is about the **update rule, the order of updates, and the boundary conditions**. Three constructions need to be kept separate.

![Colouring structures in the XOR pendulum](https://1001100.online/issledovanie/mayatnik-podsvetka-2.png)

*Author screenshot: a 512-row pendulum field at frame 50. Red and yellow highlight connected structures selected by the colouring tools. These colours are a display layer over the binary field.*

**1. Animatrix Code: a column-wise symbolic wave**

Each column is updated from top to bottom. The top cell remains unchanged. Each subsequent cell reads the already updated cell above and its own previous symbol. Equal nonblank symbols cancel to a blank; when two different nonblank symbols meet, the upper symbol wins. A blank acts as the identity. The text symbol `0` is therefore not the same as a blank.

If a column contains only a blank and one nonblank symbol, encoding them as 0 and 1 gives:

```text
b[0] = a[0]
b[i] = a[i] XOR b[i-1]
```

This is exactly the prefix-sum-modulo-2 transformation listed among the constructions of the Sierpiński pattern in [NKS, p. 931](https://www.wolframscience.com/nks/notes-5-4--sierpinski-pattern/). This identifies the binary operator; it does not identify the full mixed-symbol transient with an ordinary binary automaton.

![One recorded 128-pass cycle of Animatrix Code](https://1001100.online/issledovanie/cikl.gif)

*An existing recording of the Code cycle: passes 65–192, 128 frames, 0.35 seconds per frame. The source research reports return to the same state at pass 193. This is Code, not the diagonal rule below.*

**2. Animatrix in Mayatnik/Excel: a diagonal XOR sweep**

This is a different family of transformations. For its specific “2 ед / Rows / Down” mode, let A denote the binary field before a complete sweep and B the field after it:

```text
B[0,x] = A[0,x]
B[y,x] = A[y,x] XOR B[y-1,x-1] XOR B[y-1,x+1]
```

The two diagonal parents have already been updated; the target is still old. The width and height are fixed, and values outside the field are zero. Unlike Code, neighbouring columns interact. A recorded zero is also stored separately from an absent cell.

If D takes the XOR of the two upper diagonal neighbours, then the binary sweep is:

```text
T = (I XOR D)^(-1)
  = I XOR D XOR D^2 XOR ... XOR D^(H-1), because D^H = 0.
```

The parent contribution is Rule 90, and the update order is related to the [sequential cellular automata discussed in NKS, pp. 1034–1035](https://www.wolframscience.com/nks/notes-9-10--sequential-cellular-automata/). However, matching a local XOR table is not enough to establish equivalence of the entire system. We have not established an exact published counterpart of this full sweep with the same boundaries in the sources reviewed.

**3. The XOR pendulum: moving cones on a persistent field**

The pendulum retains a two-dimensional field between passes. A pass updates a cone from top to bottom, using the old target bit XOR its two upper diagonal neighbours. Values outside the active cone are retained. The cone apex follows:

```text
0, -1, +1, -2, +2, ...
```

A cone rooted at a has cells `(r, a-r+2j)`, with `j=0,...,r`, clipped to the field. An empty apex becomes 1; when computing the first row below it, the apex is temporarily read as 1, then its stored value is restored. Thus the mask, moving apex, and apex convention are part of the model.

The application also explores extended apex schedules. The following two author-recorded GIFs use the “skip zero / both sides together” variant, on a 256-row source with a target apex range of 1024. They illustrate that extended mode, rather than the one-cone-at-a-time schedule defined above.

![XOR pendulum, author recording A](https://1001100.online/issledovanie/xor-walk-20261107/variant-a.gif)

*Recording A: 21 recorded images, 12.74 seconds.*

![XOR pendulum, author recording B](https://1001100.online/issledovanie/xor-walk-20261107/variant-b.gif)

*Recording B: 23 recorded images, 10.08 seconds. The associated saved states are at model steps 21 and 136 respectively; these are not two recordings of an otherwise identical experiment at the same step. In this skip-zero mode, the shared-apex switch is inactive. The GIFs therefore do not establish an effect of that switch. Their playback loops do not establish a period of the model.*

**Geometry and colouring as tools for inspecting the field**

![Automatic axes between triangular zero regions](https://1001100.online/issledovanie/mayatnik-auto-axes-map.png)

*A structural map of a 64-row field after eight cone passes, at apex positions 0, −1, +1, −2, +2, −3, +3, −4. Purple outlines mark detected triangular zero regions; orange, blue and green mark axis segments before, between and after them. The analysis does not repaint the underlying bits.*

![Point-axis colouring in the XOR pendulum](https://1001100.online/wolfram/community-assets/tochka-os-1.gif)

*Point-axis colouring, converted from the author's complete 43.8-second recording: 73 frames, 640 × 318, no audio. The colour propagation follows selected bit regions downward and toward an axis. This is a visualization mode, not another Animatrix recurrence. [Original MP4 at 1028 × 512](https://1001100.online/rezultaty/mayatnik-tochka-os-1.mp4).*

I would be interested in references or comments on three questions:

- Is the diagonal sweep above studied under an established name or an equivalent coordinate representation?
- Are there known systems matching the moving-cone update, persistent target values, and alternating apex schedule together?
- For the mixed-symbol Code rule, is there a known framework for analysing the transient before a column reaches its single-symbol phase?

The goal is to identify the closest existing mathematics and make the comparison precise. **Failure to find an exact match is not a claim of novelty.**

Detailed descriptions, boundary conventions, and JavaScript sources are available here (the explanatory articles are currently in Russian):

- [The two Animatrix families and their NKS connections](https://1001100.online/wolfram/animatrix.html)
- [The XOR pendulum: rule and comparison with NKS](https://1001100.online/issledovanie/wolfram-nks/xor-pendulum-comparison.html)
- [Project source code](https://github.com/MIkhailNkmnme/Binary-Drum-Machine)

The illustrations are existing project outputs; only the MP4-to-GIF format conversion is new. No new simulation was run to prepare this post. I would welcome references, corrections, or suggestions for a compact Wolfram Language formulation.
