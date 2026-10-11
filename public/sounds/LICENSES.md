# Sound licences — مران

Every sound in this folder comes from two Kenney audio packs. Both are
**Creative Commons Zero (CC0 1.0), public domain**. They may be bundled in a
commercial app, modified freely, and need **no attribution** anywhere, in the
UI or elsewhere. Crediting "Kenney" is optional. Kenney's logo must not be used.

| Pack | Page | Download (zip) | Licence statement |
|---|---|---|---|
| Interface Sounds 1.0 (Kenney, 2020-02-11) | https://kenney.nl/assets/interface-sounds | https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip (sha256 `f2193d07…b327c81232`) | `License.txt` in the zip: "License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/ — This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" |
| Impact Sounds 1.0 (Kenney, 2019-12-19) | https://kenney.nl/assets/impact-sounds | https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip (sha256 `029d734a…5dbafa18`) | `License.txt` in the zip: the same CC0 text |

Kenney's FAQ (https://kenney.nl/support), read 2026-10-11: "all game assets on
the asset pages are public domain licensed (CC0). You're free to use them, even
in commercial projects … Attribution is not required … Do not use our logo."
CC0 legal code: https://creativecommons.org/publicdomain/zero/1.0/legalcode

## Per file

Each sound exists as `.m4a` (AAC-LC, 96 kb/s, mono, 44.1 kHz) and `.mp3`
(96 kb/s CBR, mono, 44.1 kHz, LAME gapless header). Source file paths are
inside the zips above.

| File | Plays on | Source file(s) | Pack | Licence | What was done to it |
|---|---|---|---|---|---|
| `set-done` | every completed set | `Audio/drop_003.ogg` | Interface Sounds | CC0 1.0 | tuned up 1.2 semitones (731 → 784 Hz, G5), 120 Hz high-pass, cut to 0.11 s, fades |
| `pr` | personal-record celebration | `Audio/confirmation_001.ogg` (first 0.197 s) + `Audio/confirmation_002.ogg` (from 0.197 s, −7 dB) | Interface Sounds | CC0 1.0 | joined into one rising arpeggio G4 → D8 (0.73 s); 150 Hz high-pass; 24 dB/octave low-pass at 2.9 kHz, so the top steps (A7, D8) sit back instead of ringing shrill on a phone speaker; fades |
| `raise` | «ارفع الوزن» reminder | `Audio/maximize_009.ogg` | Interface Sounds | CC0 1.0 | lead silence trimmed, 150 Hz high-pass, fades (0.21 s) |
| `rest-tick` | rest countdown, last 3 s (−3, −2, −1) | `Audio/glass_006.ogg` | Interface Sounds | CC0 1.0 | 200 Hz high-pass, cut to 0.08 s, fades |
| `rest-end` | rest over (0 s) | `Audio/glass_001.ogg` | Interface Sounds | CC0 1.0 | 200 Hz high-pass, cut to 0.26 s, fades |
| `medal` | medal lands, common | `Audio/impactMetal_light_000.ogg` | Impact Sounds | CC0 1.0 | 100 Hz high-pass, cut to 0.29 s, fade-out |
| `medal-heavy` | medal lands, rare / epic / legendary | `Audio/impactMetal_light_000.ogg` (−7 dB) + `Audio/impactBell_heavy_001.ogg` (25 ms fade-in) | Impact Sounds | CC0 1.0 | the clink over the bell's ring, 70 Hz high-pass, 1.2 s with a 0.75 s fade-out |
| `new-weight` | monthly report, new heaviest weight | `Audio/confirmation_001.ogg` | Interface Sounds | CC0 1.0 | 150 Hz high-pass, fades (0.28 s) |

All files: loudness normalised to −18 LUFS (BS.1770; clips shorter than
400 ms measured over a 400 ms window), true peak ≤ −1.4 dBTP after encoding.
`set-done` (−22.6 LUFS) and `rest-tick` (−23.3 LUFS) are 30–60 ms transients
that hit the −1.6 dBTP ceiling first. They were not limited further, because
heavy limiting would flatten them. Played at the same volume they sound about
as loud as the others.

## Checked and not used

- **Pixabay** (sound effects licence) and **freesound.org**: this session's
  network proxy blocks both (HTTP 403), so neither was downloaded.
- **Mixkit** (Sound Effects Free License): the licence page was reachable. It
  allows commercial use without attribution, but it says "You can't
  redistribute the Item on its own … or with source files". A git repository
  holding the raw files is a grey area, so it was skipped in favour of CC0.
- **Other Kenney packs** (Digital Audio, UI Audio, Music Jingles, Sci-fi,
  RPG, Casino; all CC0): downloaded and analysed. They are mostly 8-bit,
  game-jingle or foley sounds, too cartoonish or off-brief for this app.
