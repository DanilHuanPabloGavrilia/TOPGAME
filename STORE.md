# Storefront copy — Yandex Games

Every text field of the draft, in the form it should be pasted into the console.

Kept in the repository on purpose. The first rejection was traced by comparing file dates,
because what had been submitted existed only inside the console and nobody could say what
it was. Storefront copy drifts from the game exactly the way an archive drifts from the
code, and the fix is the same: one written source, versioned next to what it describes.

**The name is `Dealer's Gambit`.** One string, all languages, every field, and the same
inside the game — `<title>`, the main menu, the header on a desktop and all five
dictionaries. Requirement 5.1.3 compares them against each other, and the review found five
variants.

Below 768px the header drops its copy of the name, because the row cannot hold it and the
Back button at the same time. That is a rendering decision, not a second name: nothing shows
a different string, and on a phone the name is still on the menu and in the tab title.

## Numbers that must match the game

Check these against the code before editing any text, not after:

| Claim | Source of truth | Value |
|---|---|---|
| Item cards | `ALL_ITEMS` in `src/game/ItemCatalog.ts` | **11** |
| Locations | `LOCATIONS` in `src/game/BossCatalog.ts` | 5 |
| Bosses | 5 x 3, trainer excluded | 15 |
| Meta upgrades | `MetaUpgrades` in `src/game/Types.ts` | **3** — health, armour, damage |
| Blank self-shot payout | `BLANK_SELF_SHOT_CHIPS` | 25 $ |

The review's cover art claimed 12 cards and the description claimed a fourth upgrade,
"Бонус Капитала", which has never existed. Card names come from the dictionaries, not from
memory: it is `Hacksaw`, not "Handsaw", and `Hack Chip`, not "Hack-Chip".

**Not stated anywhere, and deliberately:** the blank self-shot pays out at most 5 times per
duel (`MAX_BLANK_SELF_SHOT_PAYOUTS`), and never in the training bout. The extra turn is
unconditional, the money is not. The in-game guide is silent about it too, so the copy below
is at least consistent with the game's own text — but a reviewer who fires a sixth blank
into their own head will see no chips, and the copy promises them.

---

# Russian

## Название

```
Dealer's Gambit
```

## Краткое описание

```
Киберпанк-дуэль на выживание! Заряжай патроны, рискуй ради бонусов
```

## Описание для SEO

```
Dealer's Gambit — тактический киберпанк-рогалик. Рискуйте в смертельной рулетке, применяйте 11 уникальных предметов, качайте базу и обыграйте казино!
```

## Об игре

```
Dealer's Gambit — киберпанк-рогалик в стиле рулетки на выживание!

Вы очнулись за подпольным столом Кибер-Казино 2088 года. Единственный путь к свободе и огромному банку — пройти 5 опасных локаций, победить 15 уникальных ИИ-диллеров и взломать Ядро Пустоты.

🔥 КЛЮЧЕВЫЕ ОСОБЕННОСТИ:

• 🎯 ТАКТИЧЕСКИЕ ДУЭЛИ: В барабан револьвера заряжается случайная комбинация БОЕВЫХ 🔴 и ХОЛОСТЫХ 🔵 патронов. Вычисляйте шансы и принимайте решения!

• 🛡️ ВЫСТРЕЛ В СЕБЯ (Секрет Победы): Рискните выстрелить в себя! Если патрон холостой — вы получите +25$ и ПОДТВЕРЖДЕННЫЙ ПОВТОРНЫЙ ХОД!

• 🎴 11 УНИКАЛЬНЫХ КАРТ-ПРЕДМЕТОВ: Используйте Лупу (узнать патрон), Ножовку (х2 урон), Энергетик, Сигарету (исцеление), Хак-чип (инвертировать заряд) и Зеркальный Щит.

• 🦾 МЕТА-ПРОКАЧКА: Зарабатывайте фишки даже при поражении! Постоянно прокачивайте максимум HP, Кибер-Броню и Базовый Урон.
```

Changed from what was submitted: 12 cards became 11; "Бонус Капитала" removed, since the
shop sells three upgrades; "(ROGUELITE)" and "Max HP" written in Russian, which is what
8.2.3 asks of a Russian field; the last bullet given the bullet the other three have.

## Как играть

```
🎯 УПРАВЛЕНИЕ:

• На ПК: Управление осуществляется ЛЕВОЙ КНОПКОЙ МЫШИ.
• На Мобильных / Планшетах: Управление НАЖАТИЕМ НА ЭКРАН (Тачскрин).

💡 ПРАВИЛА И СТРАТЕГИЯ:

1. В начале раунда вы видите число боевых 🔴 и холостых 🔵 патронов.
2. Кнопка «Выстрел в Диллера»: Наносит урон врагу, но завершает ваш ход.
3. Кнопка «Выстрел в Себя»: Если патрон холостой — вы получаете +25$ и сохраняете ход! Если боевой — получаете урон.
4. Нажимайте на карты предметов в своей руке, чтобы активировать их эффекты перед выстрелом!
5. Покупайте постоянные мета-улучшения за фишки между боями, чтобы справляться с бронированными боссами.
```

Unchanged in substance. Both button captions match the game exactly.

---

# English

## Название

```
Dealer's Gambit
```

## Краткое описание

```
Cyberpunk survival duel! Load your rounds, risk it all for bonuses!
```

## Описание для SEO

```
Tactical cyberpunk roguelike. Risk it all in deadly roulette, upgrade your base, and beat the casino!
```

## Об игре

```
Dealer's Gambit is a gripping cyberpunk survival-roulette roguelike!

You wake up at a backroom table of a Cyber-Casino in the year 2088. Your only path to freedom and a massive jackpot is to survive 5 hazardous areas, defeat 15 unique AI dealers, and hack the Void Core.

🔥 KEY FEATURES:

• 🎯 TACTICAL DUELS: The cylinder is loaded with a random combination of LIVE 🔴 and BLANK 🔵 rounds. Calculate the odds and make your move!

• 🛡️ SHOOT YOURSELF (The Key to Victory): Risk shooting yourself! If it's a blank, you earn +$25 and a GUARANTEED EXTRA TURN!

• 🎴 11 UNIQUE ITEM CARDS: Use the Magnifier (inspect the chamber), Hacksaw (double damage), Energy Drink, Cigarette (heal), Hack Chip (invert the round type), or Mirror Shield to outsmart the dealer.

• 🦾 ROGUELITE PROGRESSION: Earn chips even in defeat! Permanently upgrade your Max HP, Cyber-Armour and Base Damage.
```

Changed: 12 cards became 11; "Capital Bonus" removed; "Handsaw" and "Hack-Chip" corrected to
the names the game prints, `Hacksaw` and `Hack Chip`; "Cyber-Armor" to `Cyber-Armour`, which
is the spelling in the dictionary; and the line breaks restored — the submitted field had
lost every one of them and ran as "roguelike!You wake up".

## Как играть

```
🎯 CONTROLS:

• On PC: Use the LEFT MOUSE CLICK to interact.
• On Mobile / Tablets: Use the TOUCHSCREEN (tap to interact).

💡 RULES & STRATEGY:

1. At the start of the round, you will see the exact number of live 🔴 and blank 🔵 rounds loaded.
2. "Shoot the Dealer" button: deals damage to the enemy but ends your turn.
3. "Shoot Yourself" button: if it's a blank, you get +$25 and KEEP YOUR TURN! If it's live, you take damage.
4. Tap or click on item cards in your hand to activate their effects before taking a shot!
5. Buy permanent meta-upgrades with chips between battles to take down heavily armoured bosses.
```

Changed: line breaks restored; the button is captioned `Shoot the Dealer` in the game, not
"Shoot Dealer"; "armored" to "armoured", matching `ARMOUR` in the dictionary.

---

# Artwork — not fixable from here

The cover, the screenshots and the promo video are files, and the review objected to what is
printed on them.

**Both language slots hold the same file.** The two cover URLs in the review download
byte-for-byte identical images, so the English slot is showing the Russian cover — which is
what 8.2.3 says about "Обложка [en]" and "Рекламное видео [en]".

The English cover needs:

- the name alone, `Dealer's Gambit`, with no second line inside the title lockup — a
  subtitle set under the name reads as part of it, which is the 5.1.3 finding;
- every other word on it in English. The current one carries "КИБЕР-ОККУЛЬТНЫЙ РОГАЛИК",
  "5 ЛОКАЦИЙ", "15 БОССОВ", "12 КАРТ ПРЕДМЕТОВ";
- **11 cards, not 12**, wherever the count appears.

The Russian cover needs the same treatment of the name, and the same corrected count.
