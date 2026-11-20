# Sequential XOR patterns in Zerkalius: a moving-cone pendulum and two Animatrix rules

Draft v0.005 for Wolfram Community · 20 November 2026. Prepared for author review; not submitted to the forum. User-selected project figures are reused unchanged; the point-axis GIF is a format conversion of the complete existing MP4. The implementation is JavaScript; the mathematical connection to NKS is the subject of this discussion.

---

I am developing **Zerkalius**, a visual project exploring how simple rules produce structured patterns. I would like to share a comparison with *A New Kind of Science* and ask for references to closely related systems.

The comparison focuses on the **update rule, the order of updates, and the boundary conditions**. Three constructions need to be kept separate.

![Several coloured templates on a pendulum field](https://1001100.online/wolfram/community-assets/templates-author.png)

*Author-supplied screenshot: several coloured templates shown together on a pendulum field. **The red template is XORoXORиус**, as identified by the author. This illustrates the project's template tools; the colours should not be read as extra states of the XOR rule. The screenshot is reproduced unchanged.*

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

![Animatrix Code, complete pass 173](https://1001100.online/issledovanie/desktop-wallpapers/media/animatrix-173.png)

*Animatrix Code at complete pass 173, from a 128-row field. An existing 3840 × 2160 presentation; the gradient is a visual palette.*

![Animatrix Code: all 128 passes of the recorded cycle](https://1001100.online/issledovanie/cikl-128.png)

*The complete Code contact sheet, passes 65–192, read left to right and top to bottom. Labels give the pass number and number of ones. This is the full original image from the section shown in the author's screenshot. It displays the alternating dense and sparse patterns and recurring motifs across the cycle; these observations concern this recorded scene.*

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

**The Meeting Point, axes, and colouring**

Another focus is the **Meeting Point (Точка Встречи)**, where the diagonal guides meet. It provides a geometric reference for inspecting the field and selecting regions for colouring. The point-based tools select sources along the meeting column, or along two diagonals when the meeting falls between cells. The point-axis mode then propagates colour downward and toward the axis through the selected bit regions. This lets us follow connected forms within the larger symmetric pattern.

![Automatic axes between triangular zero regions](https://1001100.online/issledovanie/mayatnik-auto-axes-map.png)

*A structural map of a 64-row field after eight cone passes, at apex positions 0, −1, +1, −2, +2, −3, +3, −4. Purple outlines mark detected triangular zero regions; orange, blue and green mark axis segments before, between and after them. The analysis does not repaint the underlying bits.*

![Point-axis colouring in the XOR pendulum](https://1001100.online/wolfram/community-assets/tochka-os-1.gif)

*Point-axis colouring, converted from the author's complete 43.8-second recording: 73 frames, 640 × 318, no audio. The colour propagation follows selected bit regions downward and toward an axis. This is a visualization mode, not another Animatrix recurrence. [Original MP4 at 1028 × 512](https://1001100.online/rezultaty/mayatnik-tochka-os-1.mp4).*

**Zooming out: other symmetric pictures within the same frame**

Reducing the display scale reveals other symmetric pictures and motifs in the same recorded field. I use this as an exploratory tool: a pattern seen cell by cell can acquire a different visual organization when shown at a smaller scale. The underlying bit frame is retained, while the displayed result depends on the scale and pixel-sampling method. For a reproducible comparison, the frame, scale factor, and rendering method all need to be recorded. An existing [one-frame scale study with image examples](https://1001100.online/issledovanie/Zerkalius-issledovanie.html#scale-one-frame) documents this aspect of the project.

**“Under the field”: comparing resolutions together**

The **Under the field (Под полем)** tool places reduced-resolution versions beneath the original. Each version is derived from the original frame. They can be displayed at a common on-screen size, making changes in detail and symmetric motifs easier to compare. The reduction method and display size are separate settings. A selected lower version can also provide a mask for colouring or an XOR/AND/RGB overlay on the original.

The [author-supplied example][author-under-field] stores a 256-row pendulum at frame 32, with Under the field enabled, an eight-row height step, the canvas reduction method, and the original-size display option. Its requested lower resolutions therefore follow 248, 240, …, 8 rows. It also enables Wolfram Rule 110 colouring with white for 0 and black for 1. These parameters were read from the saved link; this post does not report a new application run. [Saved URL and decoded settings](https://github.com/MIkhailNkmnme/Binary-Drum-Machine/blob/main/wolfram/community-assets/author-under-field-state.json).

**Our RGB-neighbour colouring**

RGB colour encodes a local three-bit neighbourhood within one row. For left, current, and right bits `(L,C,R)`, the channels are:

```text
(red, green, blue) = (255*C, 255*L, 255*R)
```

The current bit controls red, its left neighbour controls green, and its right neighbour controls blue. This gives eight colour classes:

| Left–current–right | Colour |
|---|---|
| 000 | Black |
| 001 | Blue |
| 010 | Red |
| 011 | Magenta |
| 100 | Green |
| 101 | Cyan |
| 110 | Yellow |
| 111 | White |

For example, `101` has a zero at its centre but appears cyan because both neighbours are 1. Missing neighbours contribute zero; an absent cell remains distinct from the black class of a recorded cell. In the Animatrix reflections, neighbours are taken on the same lattice, two source-raster columns apart.

Colour classes can be selected together and displayed in colour or as a black-and-white mask. This lets us isolate local configurations and extract connected templates. Since fill and template tools follow the displayed result, combining classes can connect regions that were separate in colour. The underlying binary field is retained. [RGB method and controls](https://1001100.online/mayatnik/instruction/#rgb).

**Colouring with Wolfram rule tables**

A second colouring tool reads three bits from the row above: upper-left, upper-centre, and upper-right. Their three-bit number selects one output from a Wolfram rule table numbered 0–255, and that output chooses one of two colours for the target cell. Rule 110 is selected in the author's example.

All inputs come from the existing bit field, before manual paint. The resulting colours are not fed back as inputs for the next row. The top row keeps its previous colour and missing neighbours supply zero. This applies a familiar rule table as a colouring map over the pendulum's existing geometry. [Implementation and boundary conventions](https://1001100.online/mayatnik/instruction/#wolfram).

Together, the Meeting Point, RGB neighbourhoods, Wolfram colouring, templates such as **XORoXORиус**, and comparisons across resolutions provide several ways to explore the geometry produced by the rules.

I would be interested in references or comments on four questions:

- Is the diagonal sweep above studied under an established name or an equivalent coordinate representation?
- Are there known systems matching the moving-cone update, persistent target values, and alternating apex schedule together?
- For the mixed-symbol Code rule, is there a known framework for analysing the transient before a column reaches its single-symbol phase?
- What methods would help distinguish symmetries of the binary field from symmetric motifs produced by viewing that field at reduced resolution?

The goal is to identify the closest existing mathematics and make the comparison precise. **Failure to find an exact match is not a claim of novelty.**

Detailed descriptions, boundary conventions, and JavaScript sources are available here (the explanatory articles are currently in Russian):

- [The two Animatrix families and their NKS connections](https://1001100.online/wolfram/animatrix.html)
- [The XOR pendulum: rule and comparison with NKS](https://1001100.online/issledovanie/wolfram-nks/xor-pendulum-comparison.html)
- [Project source code](https://github.com/MIkhailNkmnme/Binary-Drum-Machine)

The illustrations are existing project outputs; only the MP4-to-GIF format conversion is new. No new simulation was run to prepare this post. I would welcome references, corrections, or suggestions for a compact Wolfram Language formulation.

[author-under-field]: https://1001100.online/mayatnik/Zerkalius-mayatnik.html#s=1.nVhbc-MqEv4vnFdPSnbuest1MjXxOBVnZ7Zmax-Q1LI5RqAF5EtS_u9bDUgCxTlVGb9YfA0NNE3317yRNUnHI0INSckkmZx9GY-_TJKX8SSdXKbHydHp-fFvMiIrkh5PRkQbaoCkb4QKVlGj2HYmSFpSrmHUY3PZqBxIKhrO38HfmSjeia74QipmlhVJidlIEoheWMXEgqREyY0OBbdMQW6YFCQlhdyIUHazyzlot7MIm8oCSEpKJpiBcMS9ohVM6ZakSThGctkoTVLCxBIUM-GQu2IBroPXmi-pWMCwyxPlYNBqoeK7bQ7cDb6xo_RM8B1JjWoiSxq6WICC4qti7612t5a8cRYYj0jNzI2sGWrqjsRhu_ZASN4oBQJ30UoACpKScY88o5ntYXvgEdbAdTDFzq2bpOSvk5PisizRPxQtzXxJCzvaz67j1Q_Ray7zVd-7pkyYu6o2ux_AFsvMGd4ZhIk1KONch2TMoCM4DHrFDrhqjBxA9mxb62n4XwMiB2eTwFax4HD3R1YxY0-yRJ2_Qcl7xjlJibRmaHtf1bD9RfnqnXIUzA1VeN002n4gYgW6LZECBhKc6mXDcGHtdfNzBF4w6cfMNiK2use_oUU0XGVy3atScjM3UM8aw5mA1uj2wqWT0zM8M6jRBZLJyYhUzttrELj8DO8m4LGREVkz2PQnhK0bKYw7ST8XgrdsgT1a6FXKyi2-tu44GRHTqKw_RotfQykVkPRkRGS7UC83S6aCre6q8Ps6nErvKnTwKfPW8k1_733vQGqbXlpTpjpFYC-_MEw0sun8FNF7LjftkLb9HXYkJcQBvxStIz3XshHBwdo-rDBLu1dsTalaoaf2k9yJQr9H5jnlYG8qIs9LWWWBgytZZbILgFvrfBZ7pDvZmNbjLXSlNVQZRqTxmYfmQDE8Z2A2AMLv5YZL3TnMqxbBztbOf5IRETKjwp2rzJcr1nWxLb8iyjnxyMtSyWaxjLvNV6ye1zQHHeN3a1A7f8ND_JtYx8AzDIAHyssYma1BcbrrwFLJV-gN-Oqvf9vE7s7j3f5Ltn1kAnTQvlFSh-1bRRffg_bVljkb_S2ZgGJ8kfxaSt5vpYNDD_4ZNh7Cxm3YeOKUiZ_vkId3SDTqRTEqFjwwM22MvNoGgPFdprT-CJ9SvTqIM6Vkf4tyNM8h7JFmNum0mKxqqmDQ0x2r3DyDjWnRnAtW2tswNzRftQZ3jiToqjdwRUVDeYzZTDQPPcohu6oCo1gew9-05NRAkRyGxwE_ypdSuRP3EEaxKVDdKIjBMIlrugm_7xtMOO3yWTETYRarWIGpIkZ-sWKwl2mQGkq2jTqgG8vNrDEh8iyj5kNwDOjWyL8604OsbkAY6LtoyI0MkgBVQPvWEmivfG2295zqZXD2NoN07UyaXojX71-1ZgVESzBQ1Wj9R5mv3oGxb4I2c0ODFJFxmq9aT_Oc7YG3GUCY7so6QwI4QmAUe5G1-8R05PqUbBuoKtn2XvKi_X6Um_bzdtt97eyXkptHmtnPihU3kkf7991fzZQp__WEq_Hfsn72ql8Nv972hOXF7cgzh47u-vYzEtEuVW2lUpiX34hu6aNaZJjx64qkl2cjUrA105Z4XIyIkQJvBmZRl4VIRf-WysZ0Q9cucRtWZZjDu5BARmRBMd0mR5PTEcELUpD0GC2htNsOp_jxZYwsRFk_HY8Il2hrd6s5C6kMaKRXMxGnBIxhX0Hi_d1FjopAR49dDmrhGykEVhhrZtAk2nKzEclovnIVieN8vv3Vb-O4Q17azWpm6ZyHHcHGzC7WwGUd3t6ScQPqZVdDp56X8oWqBXqZR6iqfc70beNiXHKUJKcjUkCOKSw5Si5GRDfa-IWdo3E4UMzXydF4MiJ5Y1BDepEkibWcFNQSEduZl_LZVnsT-30LNd67BCfgdPfCKmhPzQL3AEXm19GBU-Y8TGGEzuKW04BVBRXODVX91U6YHOHKN9bIyd7TD-vRIUOx7mOvm7_X90wUVxgbXa8ORkeYA1X58h9EP6y3oN-vPb89QY7jE0_nIWREXm3s9IzH9G74eh2EyNco8rxm1uoTN-CJBZTC8CmN279DxsHnwCG3VY5bur3ys9otBQPng-Q24kfRNOJUCDyBYrKw5raBJ1_9uysnt0x3NSqpG1Vz-GKDIIlSd2cDfARgOYmyt5-Qqxie27hPUnKFFWbJOL9SQIPLhJBlPG1NGSYpV5OHro7dvyoZ5MOesLh7hXQ1Y2YmoK9S4QKK8pRYAZqql5xmZyfnKJFrUNGYk_Iys1OiJB5Ulqf0BEUFljGHZ7KieNh5nuVWI2Dtb0ugzuzuJDIsr22yc6PGbja4PLsk76UTJ8VfJPUG08zH1-E4rC8xHLarvJeYN0glRQfN2StgWGj5Rbj383JyTjqeccBgWHGznHIsjA8M1Eby7AMZ3YL-SNQY-YFooeTmA1EFYD6ci300F_PU7fDOW-nQKQYL7c62TTZKbmYbMfBzm5VvFSvNAQhrcntlIzLr0IsB-rSkGp7owoXESNRVNf4SHRJ-EwVsDwwdFNrxlHhHXehx_vteOhNwUDgFs8RwRHIq1lQPF_WAD0A24Sm2YILyYQfv4_5JMBJdt6HWkv0nagwoYR_wmGG0qzEfQSwwn52GvHDrotNJguymSxIyb_SUqgUTuo_C7pnprX2yGOPN6d4jMWl5RhbdZO8ikSiJRI0G5WvI__wX47_7x0O4pxXjDCVvJCDA3VdL6PcjIpCjzsF4LQKrtB-WViHxvlcAr925VMyXJG9EBm-56AxHp8h-F46FgWM3e4yIHHu7pF1LjCfP6Pi8XlKSnuLmc-A-c1l7vNk3IzsKK7X2xdI9EDhr5xLLvYsxfi9ZUYBw8RzX79o3tge2da8Z97DvnqTQv_3s38SKpG97zCTK8rc3O93dGkT4vjUrulyOoyK5BcIOciCXkRgZu38qxUXi6Kgto6aPWSQlAh_79rbO0UY1dmPxy6512BtZDF44EPFviWMX6phY-DcpioMfWAFRgX6gzz_Jghf28emIbCTH2ISmBEEzDv3WG_vsNMaCw8aDIDHh7lLyV2J_ZL_HSsGe5JvN5tNwWxg7f_r04SghchPm-XbnmkzjFYlG4gpUhFSWgDyG0ctBUQHeXnKc5K7d1AFZy0IskW8F-JgTD7LH6JOs21-YIcoySTyJiV4yulFtUAkHvpGVrcgCLPJ3fOS2sfvUaQnn2h_Oxq3KA7LDqo8j1TZU7Q9k8lbvUPAZpUMK0Ooc4J9SOaAOncoY_4zKIeVoVQ7wz6gcUpVW5QD_nC3ZB7Zkf2rLA9So1fpe9CeKQ1Y11BzIPmVZdlBrDB9WOL4INHqGux-y4kDhn-x976udNiEXTNeWrr0RnSuJWaQ0_mEFm_aV6Xy83_8f
