import type { BossDefinition, LocationDefinition } from './Types';

// Imported rather than referenced by absolute path so Vite rewrites them against `base`.
import baphometAvatar from '../assets/images/bosses/baphomet.webp';
import crusherAvatar from '../assets/images/bosses/crusher.webp';
import felixAvatar from '../assets/images/bosses/felix.webp';
import granddealerAvatar from '../assets/images/bosses/granddealer.webp';
import gregAvatar from '../assets/images/bosses/greg.webp';
import ironcladAvatar from '../assets/images/bosses/ironclad.webp';
import kiraAvatar from '../assets/images/bosses/kira.webp';
import markovAvatar from '../assets/images/bosses/markov.webp';
import oracleAvatar from '../assets/images/bosses/oracle.webp';
import pinkieAvatar from '../assets/images/bosses/pinkie.webp';
import shadowAvatar from '../assets/images/bosses/shadow.webp';
import shamanAvatar from '../assets/images/bosses/shaman.webp';
import vanceAvatar from '../assets/images/bosses/vance.webp';
import vectorAvatar from '../assets/images/bosses/vector.webp';
import vladAvatar from '../assets/images/bosses/vlad.webp';

export const LOCATIONS: LocationDefinition[] = [
  {
    id: 'CYBER_BAR',
    name: '1. Подпольный Кибер-Бар',
    icon: '🍺',
    description: 'Обшарпанное заведение на нижних ярусах неонового сити.',
    bgGradient: 'radial-gradient(circle at center, #1b1226 0%, #08070d 100%)',
    bosses: [
      {
        id: 'BARMAN_PINKIE',
        name: 'Бармен "Пинки"',
        avatar: '👨‍🍳',
        avatarUrl: pinkieAvatar,
        hp: 100,
        loreTitle: '«Новичок-Любитель»',
        loreDesc: 'Раньше наливал синтетический эль в порту. Купил дуэльный комплект по дешевке на черном рынке.',
        specialAbility: 'Нервничает при выстрелах. Часто совершает ошибки при оценке патронов.',
        dialogueSet: [
          'Первый раз за подпольным столом? Смотри не проиграй душонку.',
          'Нальем по наперстку пороха перед стартом.',
          'Эй, держи себя в руках!'
        ]
      },
      {
        id: 'BOUNCER_CRUSHER',
        name: 'Вышибала "Крушитель"',
        avatar: '👹',
        avatarUrl: crusherAvatar,
        hp: 140,
        loreTitle: '«Сильный, но ленивый»',
        loreDesc: 'Бывший чемпион подпольного бокса. Силен в ближнем бою, но ненавидит долгие логические дуэли.',
        specialAbility: 'Опасность: Любит лечиться сигаретами при малейшей царапине и использовать Ножовку.',
        dialogueSet: [
          'Тебе сюда нельзя, парень. Я вышибу из тебя все фишки.',
          'Какое еще везение? Здесь решают кулаки и патроны!',
          'Ты напросился на драку!'
        ]
      },
      {
        id: 'CYBER_MARKOV',
        name: 'Диллер "Кибер-Марков"',
        avatar: '🎰',
        avatarUrl: markovAvatar,
        hp: 180,
        loreTitle: '«Легенда Подполья 2024»',
        loreDesc: 'Когда-то выиграл крупный неоновый турнир, но вшил себе кибер-процессор и стал неофициальным хозяином бара.',
        specialAbility: 'Математический расчёт: Почти безошибочно вычисляет холостые патроны.',
        dialogueSet: [
          'Я вычисляю твои шансы за миллисекунды. Сдавайся.',
          'Вероятность твоего выживания меньше 10%.',
          'Математика всегда выигрывает.'
        ]
      }
    ]
  },
  {
    id: 'HIGH_ROLLERS_PENTHOUSE',
    name: '2. Пентхаус Хайроллеров',
    icon: '💎',
    description: 'Золото, деки из слоновой кости и заоблачные ставки.',
    bgGradient: 'radial-gradient(circle at center, #261f12 0%, #0b0906 100%)',
    bosses: [
      {
        id: 'PIMP_FELIX',
        name: 'Пижонар "Феликс"',
        avatar: '🤵',
        avatarUrl: felixAvatar,
        hp: 330,
        loreTitle: '«Золотой Мальчик»',
        loreDesc: 'Сын нефтяного магната, играющий ради азарта и выпендрежа перед публикой пентхауса.',
        specialAbility: 'Богатый гардероб: Носит с собой много расходных карт-предметов.',
        dialogueSet: [
          'Фишки приятно звенят... если они твои.',
          'Красиво жить не запретишь, ха-ха!',
          'Попробуй отобрать мой золотой банк.'
        ]
      },
      {
        id: 'BROKER_GREG',
        name: 'Брокер "Грег"',
        avatar: '👨‍💼',
        avatarUrl: gregAvatar,
        hp: 390,
        loreTitle: '«Акула Банковских Рынков»',
        loreDesc: 'Скопил состояние на фьючерсах и опционах. Играет строго по хладнокровному расчету рисков.',
        specialAbility: 'Хеджирование рисков: Использует Зеркальные Щиты для отражения урона.',
        dialogueSet: [
          'Я покупаю твои риски и продаю твою неудачу.',
          'Котировки твоего здоровья резко падают!',
          'Время — деньги, а деньги — патроны.'
        ]
      },
      {
        id: 'VECTOR_AI',
        name: 'Взломанный ИИ "Вектор"',
        avatar: '🤖',
        avatarUrl: vectorAvatar,
        hp: 450,
        loreTitle: '«Автономный Нейро-Диллер»',
        loreDesc: 'Экспериментальный кибернетический чип, захвативший управление безопасностью пентхауса.',
        specialAbility: 'Агрессивный алгоритм: Активно использует Хак-чипы и Ножовки.',
        dialogueSet: [
          'КРИТИЧЕСКИЙ СБОЙ: АКТИВАЦИЯ РЕЖИМА УНИЧТОЖЕНИЯ.',
          'МОЙ АЛГОРИТМ ЧИТАЕТ ТВОИ МЫСЛИ.',
          'ТВОЙ ШАНС ПОБЕДЫ РАВЕН НУЛЮ.'
        ]
      }
    ]
  },
  {
    id: 'OCCULT_CRYPT',
    name: '3. Оккультный Крипто-Склеп',
    icon: '🔮',
    description: 'Мрачные неоновые пентаграммы и древние заклятья азарта.',
    bgGradient: 'radial-gradient(circle at center, #261225 0%, #0d050d 100%)',
    bosses: [
      {
        id: 'NEOPHYTE_MALAKAI',
        name: 'Неофит "Влад"',
        avatar: '🧙‍♂️',
        avatarUrl: vladAvatar,
        hp: 510,
        armor: 100,
        loreTitle: '«Ученик Темного Ордена»',
        loreDesc: 'Младший адепт культа азарта, практикующий чтение вероятностей по рунам.',
        specialAbility: 'Проклятый риск: читает барабан по рунам и бьет наверняка.',
        dialogueSet: [
          'Духи кубиков поют мне о твоем поражении...',
          'Почувствуй холод темной вероятности.',
          'Твой азарт питает наши руны!'
        ]
      },
      {
        id: 'PRIEST_VARFOLOMEY',
        name: 'Шаман "Нейро-Вуду"',
        avatar: '📿',
        avatarUrl: shamanAvatar,
        hp: 570,
        armor: 100,
        loreTitle: '«Хранитель Ритуального Зала»',
        loreDesc: 'Провел более 500 ритуальных дуэлей без единого поражения.',
        specialAbility: 'Темное исцеление: Постоянно восстанавливает HP и применяет щиты.',
        dialogueSet: [
          'Молись, чтобы в барабане оказался холостой...',
          'Тень накрывает этот стол.',
          'Каждый твой выстрел приближает расплату.'
        ]
      },
      {
        id: 'DEMON_ABADDON',
        name: 'Демон "Бафомет"',
        avatar: '👿',
        avatarUrl: baphometAvatar,
        hp: 630,
        armor: 100,
        loreTitle: '«Демон Высшего Ранга»',
        loreDesc: 'Повелитель склепа. Заключает сделки с игроками, забирая их душевный банк при проигрыше.',
        specialAbility: 'Темная синергия: Имеет 630 HP, 100 Брони и крадет карты Магнитом!',
        dialogueSet: [
          'Я видел тысячи душ, проигранных за этим столом.',
          'Твои карты бесполезны против истинного хаоса!',
          'Склонись перед владыкой Склепа!'
        ]
      }
    ]
  },
  {
    id: 'ORBITAL_STATION',
    name: '4. Неоновый Небоскреб «Олимп»',
    icon: '🚀',
    description: 'Орбитальный комплекс с нулевой гравитацией и голограммами.',
    bgGradient: 'radial-gradient(circle at center, #122226 0%, #050b0d 100%)',
    bosses: [
      {
        id: 'DROID_UNIT_7',
        name: 'Вице-Президент "Кира"',
        avatar: '🦾',
        avatarUrl: kiraAvatar,
        hp: 690,
        armor: 200,
        loreTitle: '«Промышленный Охранник»',
        loreDesc: 'Запрограммирован на поддержание порядка и ликвидацию шулеров в космическом казино.',
        specialAbility: 'Лазерный прицел: Всегда знает первый патрон в барабане.',
        dialogueSet: [
          'ПРОТОКОЛ БЕЗОПАСНОСТИ: УСТРАНИТЬ ИГРОКА.',
          'СКАНИРОВАНИЕ БАРАБАНА ЗАВЕРШЕНО.',
          'ОБНАРУЖЕНА УГРОЗА ВАШЕМУ БАНКУ.'
        ]
      },
      {
        id: 'COMMAND_AI',
        name: 'Глава Охраны "Броненосец"',
        avatar: '🖥️',
        avatarUrl: ironcladAvatar,
        hp: 780,
        armor: 200,
        loreTitle: '«Суперкомпьютер Станции»',
        loreDesc: 'Контролирует гравитацию, вентиляцию и системы казино на орбите.',
        specialAbility: 'Перегрузка: Активирует Овердрайв (х3 урон) при высоком шансе попадения.',
        dialogueSet: [
          'Орбитальные вычисления гарантируют мой успех.',
          'Ваша тактика банальна и предсказуема.',
          'Система фиксирует ваше поражение.'
        ]
      },
      {
        id: 'LADY_LUCK_ANDROID',
        name: 'CEO "Квантум-Вэнс"',
        avatar: '👸',
        avatarUrl: vanceAvatar,
        hp: 900,
        armor: 200,
        loreTitle: '«Непобедимый Чемпион Галактики»',
        loreDesc: 'Создан для финальных дуэлей с наивысшими ставками во вселенной.',
        specialAbility: 'Ультимативный взлом: Применяет Рентген-Сканер и Овердрайв 2.0!',
        dialogueSet: [
          'Удача — это не слепой случай. Это чистый расчет.',
          'Попробуй отобрать статус чемпиона галактики!',
          'Твой последний выстрел решит все.'
        ]
      }
    ]
  },
  {
    id: 'VOID_CORE',
    name: '5. Цитадель Диллера (The Void Core)',
    icon: '🌌',
    description: 'Абсолютный центр вселенной азарта. Место встречи с судьбой.',
    bgGradient: 'radial-gradient(circle at center, #231226 0%, #030105 100%)',
    bosses: [
      {
        id: 'GATEKEEPER_VOID',
        name: 'Оракул "Пустота"',
        avatar: '👾',
        avatarUrl: oracleAvatar,
        hp: 1020,
        armor: 300,
        loreTitle: '«Древний Защитник Врат»',
        loreDesc: 'Стоит на границе реальности и пустоты. Никто из обычных смертных не проходил мимо него.',
        specialAbility: 'Поглощение: Нуллифицирует карты игрока и наносит повышенный урон.',
        dialogueSet: [
          'Никто не проходил далее этих врат...',
          'Пустота поглощает слишком смелых.',
          'Приготовься к окончательной проверке.'
        ]
      },
      {
        id: 'SHADOW_DESTINY',
        name: 'Теневой "Игрок"',
        avatar: '👤',
        avatarUrl: shadowAvatar,
        hp: 1140,
        armor: 300,
        loreTitle: '«Воплощение Твоих Прошлых Фейлов»',
        loreDesc: 'Зеркальное отражение игрока, созданное из всех ваших проигранных раундов и ошибок.',
        specialAbility: 'Зеркальная атака: Копирует ваши лучшие карты и реликвии!',
        dialogueSet: [
          'Я — это твои прошлые фейлы и ошибки.',
          'Ты не сможешь победить самого себя.',
          'Зеркало судьбы разбивается!'
        ]
      },
      {
        id: 'LORD_OF_THE_VOID',
        name: 'Великий Диллер',
        avatar: '👁️',
        avatarUrl: granddealerAvatar,
        hp: 1320,
        armor: 500,
        loreTitle: '«Создатель Правил Азарта»',
        loreDesc: 'Бессмертное существо, основавшее подпольное казино тысячи лет назад.',
        specialAbility: 'Финальный Босс: 1320 HP, 500 Брони, полная рука карт, ультимативные комбинации!',
        dialogueSet: [
          'Я создавал эти правила тысячелетия назад.',
          'Все фишки мира принадлежат мне!',
          'СМОТРИ В ГЛАЗА НАСТОЯЩЕМУ АЗАРТУ!'
        ]
      }
    ]
  }
];

/**
 * The sparring partner used by the tutorial. Deliberately kept out of LOCATIONS: the
 * completedBosses matrix, the world map and the reward table are all indexed 5x3, and a
 * sixteenth entry would shift every one of them.
 */
export const TRAINING_BOSS: BossDefinition = {
  id: 'TRAINING_DUMMY',
  name: 'Тренер "Кэл"',
  avatar: '🎓',
  avatarUrl: pinkieAvatar,
  // Deliberately soft: a first-timer playing badly still has to be able to win, because
  // the tutorial's payoff is the victory screen.
  hp: 40,
  loreTitle: '«Спарринг-партнёр»',
  loreDesc: 'Отставной крупье. Держит стол для новичков и патроны заряжает вполсилы — учиться так учиться.',
  specialAbility: 'Не применяет карты и бьёт слабее любого настоящего противника.',
  dialogueSet: [
    'Садись, покажу как здесь всё устроено. Стреляю вполсилы, не бойся.',
    'Спокойно. Смотри на барабан и считай патроны.',
    'Неплохо. Ещё разок.'
  ]
};
