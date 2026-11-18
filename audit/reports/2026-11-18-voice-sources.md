# ГОЛ-002 · Остатки старого голоса и сторонние референсы

18 ноября 2026. Основа проверки — свежий `origin/main` **43a2a44747bf35a2e423715fdd25a14bf2720f49**, полученный через `git fetch` и перенесённый в локальный main до правок. Это проверка файлов/исходников и происхождения, не прослушивание. Сторонние референсы пока не удаляются: пользователь попросил сначала перечислить их.

## Наши прежние голоса: что убрано

- Коммит `60c301c81` уже удалил шесть старых SAPI-производных MP3: `letters-zerkalius`, `loop-letters-zerkalius-ducked`, `loop-ru-count`, `numbers-67`, `numbers-sketch`, `vocoder-ru`; шесть генераторов/миксеров и три спектрограммы. Эти изменения сохранены.
- В ГОЛ-002 удалены оставшиеся `mayatnik/sign-voice/sign-bank.wav`, `sign-bank.json`, `generate_sign_bank.py`. Старый банк был отключён в ГОЛ-001, но ещё лежал на сайте и в дереве файлов.
- Из пяти локальных ZIP удалены 27 старых голосовых entries; остальные entries сохранены. В каждый ZIP добавлена `LEGACY-VOICE-REMOVED.txt`: очищенный ZIP больше не является побайтовым исходным архивом соответствующего коммита.
- В старой локальной рабочей копии `_scratch/phone-live-20261117` удалены восемь оставшихся старых генераторов/manifest. Старого WAV/MP3 там уже не было.
- Адресный след `E:/NineToZero/voice` проверен: такой папки на этом компьютере нет.
- По blob ID прежних семи голосовых аудиофайлов совпадений в актуальном индексе Git не осталось. Это поиск точных копий, а не акустическое распознавание изменённых фонограмм.

Локальные очищенные архивы относительно корня Зеркалиуса:

1. `archive/Mayatnik-Synthesis/v014/source-54872287.zip`
2. `archive/Mayatnik-Synthesis/v017/source-0c0fb14f.zip`
3. `archive/Zerkalius-mayatnik/v1033/source-fd65bde6.zip`
4. `archive/Zerkalius-mayatnik/v1034/source-dadcb245.zip`
5. `archive/Zerkalius-issledovanie/v131/source-fd65bde6.zip`

Локальный протокол: `archive/legacy-voice-cleanup-20261118.json`. История Git не переписана: прежние коммиты всё ещё содержат удалённые файлы. Копии на других компьютерах и кэш чужих браузеров этой операцией не очищаются.

SAPI — интерфейс синтеза; по его названию нельзя доказать устройство конкретного голоса. Причина исключения Irina/Zira — отсутствие подтверждения, что они не используют человеческие записи. Термин «аналоговый» здесь не означает формат WAV/MP3: эти файлы цифровые, вопрос в происхождении речевого сигнала.

## Наши процедурные голоса: оставлены

| Материал | Источник речи |
|---|---|
| «Голос знаков»: 69 букв/цифр и два примера | `mayatnik/sign-voice/generate_procedural_bank.py`: гармоники, вычисленный шум, четыре резонатора |
| `numbers-67-synth.mp3`, `loop-letters-synth.mp3` | `tools/voice/formant_voice.py` и миксеры: импульсный источник, шум, три резонатора; инструментальная подложка отдельно |
| Робот в Маятнике и телефонных опытах | `mayatnik/mayatnik-phone-robot.js`: собственные фонемные параметры и синтез, не запись Roboter |

Код генераторов прочитан. Подтверждение отсутствия голосовой фонограммы на входе не является подтверждением разборчивости всех звуков на слух.

## Сторонние ссылки и плееры: пока оставлены

Наличие речи/вокала и происхождение полного мастер-трека не устанавливались новым прослушиванием. Эти записи нельзя автоматически объявлять полностью процедурными или целиком человеческими. В том числе аналоговый синтезатор сам по себе не означает запись человеческого голоса.

| Референс | Где в проекте | Что известно из сохранённых материалов |
|---|---|---|
| [Andrew Shaw — Numbers / Computerworld ’91](https://www.youtube.com/watch?v=qNv7ZW1e1I8) | `issledovanie/pendulum-music/#andrew-shaw`, YouTube-плеер | В статье описано управление фонемами Robovox; происхождение всех звуков записи не подтверждено |
| [Jean-Luc Deladrière — Roboter](https://soundcloud.com/jean-luc-deladri-re/roboter-1) | та же статья, SoundCloud-плеер | Описание Emy/Robovox, музыка Marty; в наш генератор фонограмма не включена |
| [Karl Bartos — Numbers / Computer World](https://www.youtube.com/watch?v=yaC2zD8C6EU) | `issledovanie/bartos-numbers/`, внешняя ссылка | Музыкальный референс и измеренные графики; не исходник нашего голоса |
| [Enrico Sangiuliano — Step Into The End](https://www.youtube.com/watch?v=HZA-wy4qJCU) | `issledovanie/pendulum-music/#step-into-the-end`, YouTube-плеер | Сторонний трек; в NINETOZERO есть два локальных превью версий |
| [KOBTRAX — Elektronische Träume](https://www.youtube.com/watch?v=f-dUVYPt1Pk) | статья и «Музыка → Слушать» Маятника | Внешний альбом; описание аналоговой эстетики не доказывает наличие человеческой речи |
| [Enrico Sangiuliano — The Techno Code](https://www.youtube.com/watch?v=FpYyI8xvCy0) | `sources/ninetozero/`, ссылка и тексты | Исходный комментарий пользователя и перевод, не подтверждённая расшифровка голоса; два превью ниже |

У NINETOZERO также сохранены кадры/ссылки коллекции YouTube: изображения не содержат звука. Старые собственные ссылки на SAPI-видео Numbers `PXzrazgjn4w` и буквы `eVlITB0Se5Y` отсутствуют в актуальном блоге. Доступность/удаление самих роликов на YouTube в этой проверке не подтверждались; изменения внешнего аккаунта не выполнялись.

## 33 локальных превью NINETOZERO

Это сохранённые сторонние M4A, 30–90 секунд по README коллекции. Для каждого не подтверждена гарантия отсутствия записей человека. **Silence (Vocal Mix)** прямо обозначен вокальным в названии; это ещё не доказывает конкретную технологию его голоса. Остальные нельзя называть вокальными только по названию.

| Релиз | Композиция | Локальный файл |
|---|---|---|
| Silence | Silence (Inner Mix) | [00-00-silence-inner-mix-preview.m4a](../../sources/ninetozero/audio/00-00-silence-inner-mix-preview.m4a) |
| Silence | Future Dust (Original Mix) | [00-01-future-dust-original-mix-preview.m4a](../../sources/ninetozero/audio/00-01-future-dust-original-mix-preview.m4a) |
| Silence | New Expression of Love (Original Mix) | [00-02-new-expression-of-love-original-mix-preview.m4a](../../sources/ninetozero/audio/00-02-new-expression-of-love-original-mix-preview.m4a) |
| Silence | Silence (Vocal Mix) | [00-03-silence-vocal-mix-preview.m4a](../../sources/ninetozero/audio/00-03-silence-vocal-mix-preview.m4a) |
| Sound Of Space | The Sound Of Space | [01-00-the-sound-of-space-preview.m4a](../../sources/ninetozero/audio/01-00-the-sound-of-space-preview.m4a) |
| Sound Of Space | Spatial Perception | [01-01-spatial-perception-preview.m4a](../../sources/ninetozero/audio/01-01-spatial-perception-preview.m4a) |
| Reflection | Reflection (Original Mix) | [02-00-reflection-original-mix-preview.m4a](../../sources/ninetozero/audio/02-00-reflection-original-mix-preview.m4a) |
| Reflection | Reflection (Intro Mix) | [02-01-reflection-intro-mix-preview.m4a](../../sources/ninetozero/audio/02-01-reflection-intro-mix-preview.m4a) |
| Reflection | Source Of Propagation | [02-02-source-of-propagation-preview.m4a](../../sources/ninetozero/audio/02-02-source-of-propagation-preview.m4a) |
| Physical Change | Physical Change (Original Mix) | [03-00-physical-change-original-mix-preview.m4a](../../sources/ninetozero/audio/03-00-physical-change-original-mix-preview.m4a) |
| Physical Change | Pulse Of Progression (Original Mix) | [03-01-pulse-of-progression-original-mix-preview.m4a](../../sources/ninetozero/audio/03-01-pulse-of-progression-original-mix-preview.m4a) |
| Glitch In Time | Glitch In Time (Original Mix) | [04-00-glitch-in-time-original-mix-preview.m4a](../../sources/ninetozero/audio/04-00-glitch-in-time-original-mix-preview.m4a) |
| Glitch In Time | Arresto Momentum (Original Mix) | [04-01-arresto-momentum-original-mix-preview.m4a](../../sources/ninetozero/audio/04-01-arresto-momentum-original-mix-preview.m4a) |
| Glitch In Time | Skylark (Original Mix) | [04-02-skylark-original-mix-preview.m4a](../../sources/ninetozero/audio/04-02-skylark-original-mix-preview.m4a) |
| Glitch In Time | Distant Memories (Original Mix) | [04-03-distant-memories-original-mix-preview.m4a](../../sources/ninetozero/audio/04-03-distant-memories-original-mix-preview.m4a) |
| Glitch In Time | Diagonal Matrix (Original Mix) | [04-04-diagonal-matrix-original-mix-preview.m4a](../../sources/ninetozero/audio/04-04-diagonal-matrix-original-mix-preview.m4a) |
| Interconnection | Interconnection (Original Mix) | [05-00-interconnection-original-mix-preview.m4a](../../sources/ninetozero/audio/05-00-interconnection-original-mix-preview.m4a) |
| Interconnection | Can U Feel It (Original Mix) | [05-01-can-u-feel-it-original-mix-preview.m4a](../../sources/ninetozero/audio/05-01-can-u-feel-it-original-mix-preview.m4a) |
| Interconnection | Can U Feel It (Acid Boost) | [05-02-can-u-feel-it-acid-boost-preview.m4a](../../sources/ninetozero/audio/05-02-can-u-feel-it-acid-boost-preview.m4a) |
| Transcendence | Transcendence | [06-00-transcendence-preview.m4a](../../sources/ninetozero/audio/06-00-transcendence-preview.m4a) |
| Transcendence | The Inner World | [06-01-the-inner-world-preview.m4a](../../sources/ninetozero/audio/06-01-the-inner-world-preview.m4a) |
| Transcendence | Transcendence (Edit) | [06-02-transcendence-edit-preview.m4a](../../sources/ninetozero/audio/06-02-transcendence-edit-preview.m4a) |
| Discipline | The Techno Code | [07-00-the-techno-code-preview.m4a](../../sources/ninetozero/audio/07-00-the-techno-code-preview.m4a) |
| Discipline | We Build And Reset | [07-01-we-build-and-reset-preview.m4a](../../sources/ninetozero/audio/07-01-we-build-and-reset-preview.m4a) |
| Discipline | You Know What I Was Thinking | [07-02-you-know-what-i-was-thinking-preview.m4a](../../sources/ninetozero/audio/07-02-you-know-what-i-was-thinking-preview.m4a) |
| Discipline | The Techno Code (Edit) | [07-03-the-techno-code-edit-preview.m4a](../../sources/ninetozero/audio/07-03-the-techno-code-edit-preview.m4a) |
| Order In Chaos | Adaptation for Strings and 909 | [08-00-adaptation-for-strings-and-909-preview.m4a](../../sources/ninetozero/audio/08-00-adaptation-for-strings-and-909-preview.m4a) |
| Order In Chaos | Order in Chaos | [08-01-order-in-chaos-preview.m4a](../../sources/ninetozero/audio/08-01-order-in-chaos-preview.m4a) |
| Order In Chaos | Dissolution | [08-02-dissolution-preview.m4a](../../sources/ninetozero/audio/08-02-dissolution-preview.m4a) |
| Absence | Step Into The End (Original Mix) | [09-00-step-into-the-end-original-mix-preview.m4a](../../sources/ninetozero/audio/09-00-step-into-the-end-original-mix-preview.m4a) |
| Absence | Step Into The End (Edit) | [09-01-step-into-the-end-edit-preview.m4a](../../sources/ninetozero/audio/09-01-step-into-the-end-edit-preview.m4a) |
| Absence | Absence (Original Mix) | [09-02-absence-original-mix-preview.m4a](../../sources/ninetozero/audio/09-02-absence-original-mix-preview.m4a) |
| Absence | The Aftermath (Original Mix) | [09-03-the-aftermath-original-mix-preview.m4a](../../sources/ninetozero/audio/09-03-the-aftermath-original-mix-preview.m4a) |

Сторонние превью и плееры перечислены для решения пользователя и не используются новым голосовым банком. Проверка доставки удаления будет записана после публикации.
