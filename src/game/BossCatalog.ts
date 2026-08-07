import type { BossDefinition, LocationDefinition } from './Types';
import { t } from '../i18n';

// Imported rather than referenced by absolute path so Vite rewrites them against `base`.
import baphometAvatar from '../assets/images/bosses/baphomet.webp';
import crusherAvatar from '../assets/images/bosses/crusher.webp';
import felixAvatar from '../assets/images/bosses/felix.webp';
import granddealerAvatar from '../assets/images/bosses/granddealer.webp';
import gregAvatar from '../assets/images/bosses/greg.webp';
import ilshmonsterAvatar from '../assets/images/bosses/ilshmonster.webp';
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

/**
 * The text fields below hold i18n keys, not prose — see the two resolvers at the bottom of
 * this file. The catalog is built at import time, long before the platform tells us which
 * language to speak, so nothing here can be translated in place.
 */
export const LOCATIONS: LocationDefinition[] = [
  {
    id: 'CYBER_BAR',
    name: 'loc.CYBER_BAR.name',
    icon: '🍺',
    description: 'loc.CYBER_BAR.desc',
    bgGradient: 'radial-gradient(circle at center, #1b1226 0%, #08070d 100%)',
    bosses: [
      {
        id: 'BARMAN_PINKIE',
        name: 'boss.BARMAN_PINKIE.name',
        avatar: '👨‍🍳',
        avatarUrl: pinkieAvatar,
        hp: 100,
        loreTitle: 'boss.BARMAN_PINKIE.title',
        loreDesc: 'boss.BARMAN_PINKIE.lore',
        specialAbility: 'boss.BARMAN_PINKIE.ability',
        dialogueSet: [
          'boss.BARMAN_PINKIE.dlg0',
          'boss.BARMAN_PINKIE.dlg1',
          'boss.BARMAN_PINKIE.dlg2'
        ]
      },
      {
        id: 'BOUNCER_CRUSHER',
        name: 'boss.BOUNCER_CRUSHER.name',
        avatar: '👹',
        avatarUrl: crusherAvatar,
        hp: 140,
        loreTitle: 'boss.BOUNCER_CRUSHER.title',
        loreDesc: 'boss.BOUNCER_CRUSHER.lore',
        specialAbility: 'boss.BOUNCER_CRUSHER.ability',
        dialogueSet: [
          'boss.BOUNCER_CRUSHER.dlg0',
          'boss.BOUNCER_CRUSHER.dlg1',
          'boss.BOUNCER_CRUSHER.dlg2'
        ]
      },
      {
        id: 'CYBER_MARKOV',
        name: 'boss.CYBER_MARKOV.name',
        avatar: '🎰',
        avatarUrl: markovAvatar,
        hp: 180,
        loreTitle: 'boss.CYBER_MARKOV.title',
        loreDesc: 'boss.CYBER_MARKOV.lore',
        specialAbility: 'boss.CYBER_MARKOV.ability',
        dialogueSet: [
          'boss.CYBER_MARKOV.dlg0',
          'boss.CYBER_MARKOV.dlg1',
          'boss.CYBER_MARKOV.dlg2'
        ]
      }
    ]
  },
  {
    id: 'HIGH_ROLLERS_PENTHOUSE',
    name: 'loc.HIGH_ROLLERS_PENTHOUSE.name',
    icon: '💎',
    description: 'loc.HIGH_ROLLERS_PENTHOUSE.desc',
    bgGradient: 'radial-gradient(circle at center, #261f12 0%, #0b0906 100%)',
    bosses: [
      {
        id: 'PIMP_FELIX',
        name: 'boss.PIMP_FELIX.name',
        avatar: '🤵',
        avatarUrl: felixAvatar,
        hp: 330,
        loreTitle: 'boss.PIMP_FELIX.title',
        loreDesc: 'boss.PIMP_FELIX.lore',
        specialAbility: 'boss.PIMP_FELIX.ability',
        dialogueSet: [
          'boss.PIMP_FELIX.dlg0',
          'boss.PIMP_FELIX.dlg1',
          'boss.PIMP_FELIX.dlg2'
        ]
      },
      {
        id: 'BROKER_GREG',
        name: 'boss.BROKER_GREG.name',
        avatar: '👨‍💼',
        avatarUrl: gregAvatar,
        hp: 390,
        loreTitle: 'boss.BROKER_GREG.title',
        loreDesc: 'boss.BROKER_GREG.lore',
        specialAbility: 'boss.BROKER_GREG.ability',
        dialogueSet: [
          'boss.BROKER_GREG.dlg0',
          'boss.BROKER_GREG.dlg1',
          'boss.BROKER_GREG.dlg2'
        ]
      },
      {
        id: 'VECTOR_AI',
        name: 'boss.VECTOR_AI.name',
        avatar: '🤖',
        avatarUrl: vectorAvatar,
        hp: 450,
        loreTitle: 'boss.VECTOR_AI.title',
        loreDesc: 'boss.VECTOR_AI.lore',
        specialAbility: 'boss.VECTOR_AI.ability',
        dialogueSet: [
          'boss.VECTOR_AI.dlg0',
          'boss.VECTOR_AI.dlg1',
          'boss.VECTOR_AI.dlg2'
        ]
      }
    ]
  },
  {
    id: 'OCCULT_CRYPT',
    name: 'loc.OCCULT_CRYPT.name',
    icon: '🔮',
    description: 'loc.OCCULT_CRYPT.desc',
    bgGradient: 'radial-gradient(circle at center, #261225 0%, #0d050d 100%)',
    bosses: [
      {
        id: 'NEOPHYTE_MALAKAI',
        name: 'boss.NEOPHYTE_MALAKAI.name',
        avatar: '🧙‍♂️',
        avatarUrl: vladAvatar,
        hp: 510,
        armor: 100,
        loreTitle: 'boss.NEOPHYTE_MALAKAI.title',
        loreDesc: 'boss.NEOPHYTE_MALAKAI.lore',
        specialAbility: 'boss.NEOPHYTE_MALAKAI.ability',
        dialogueSet: [
          'boss.NEOPHYTE_MALAKAI.dlg0',
          'boss.NEOPHYTE_MALAKAI.dlg1',
          'boss.NEOPHYTE_MALAKAI.dlg2'
        ]
      },
      {
        id: 'PRIEST_VARFOLOMEY',
        name: 'boss.PRIEST_VARFOLOMEY.name',
        avatar: '📿',
        avatarUrl: shamanAvatar,
        hp: 570,
        armor: 100,
        loreTitle: 'boss.PRIEST_VARFOLOMEY.title',
        loreDesc: 'boss.PRIEST_VARFOLOMEY.lore',
        specialAbility: 'boss.PRIEST_VARFOLOMEY.ability',
        dialogueSet: [
          'boss.PRIEST_VARFOLOMEY.dlg0',
          'boss.PRIEST_VARFOLOMEY.dlg1',
          'boss.PRIEST_VARFOLOMEY.dlg2'
        ]
      },
      {
        id: 'DEMON_ABADDON',
        name: 'boss.DEMON_ABADDON.name',
        avatar: '👿',
        avatarUrl: baphometAvatar,
        hp: 630,
        armor: 100,
        loreTitle: 'boss.DEMON_ABADDON.title',
        loreDesc: 'boss.DEMON_ABADDON.lore',
        specialAbility: 'boss.DEMON_ABADDON.ability',
        dialogueSet: [
          'boss.DEMON_ABADDON.dlg0',
          'boss.DEMON_ABADDON.dlg1',
          'boss.DEMON_ABADDON.dlg2'
        ]
      }
    ]
  },
  {
    id: 'ORBITAL_STATION',
    name: 'loc.ORBITAL_STATION.name',
    icon: '🚀',
    description: 'loc.ORBITAL_STATION.desc',
    bgGradient: 'radial-gradient(circle at center, #122226 0%, #050b0d 100%)',
    bosses: [
      {
        id: 'DROID_UNIT_7',
        name: 'boss.DROID_UNIT_7.name',
        avatar: '🦾',
        avatarUrl: kiraAvatar,
        hp: 690,
        armor: 200,
        loreTitle: 'boss.DROID_UNIT_7.title',
        loreDesc: 'boss.DROID_UNIT_7.lore',
        specialAbility: 'boss.DROID_UNIT_7.ability',
        dialogueSet: [
          'boss.DROID_UNIT_7.dlg0',
          'boss.DROID_UNIT_7.dlg1',
          'boss.DROID_UNIT_7.dlg2'
        ]
      },
      {
        id: 'COMMAND_AI',
        name: 'boss.COMMAND_AI.name',
        avatar: '🖥️',
        avatarUrl: ironcladAvatar,
        hp: 780,
        armor: 200,
        loreTitle: 'boss.COMMAND_AI.title',
        loreDesc: 'boss.COMMAND_AI.lore',
        specialAbility: 'boss.COMMAND_AI.ability',
        dialogueSet: [
          'boss.COMMAND_AI.dlg0',
          'boss.COMMAND_AI.dlg1',
          'boss.COMMAND_AI.dlg2'
        ]
      },
      {
        id: 'LADY_LUCK_ANDROID',
        name: 'boss.LADY_LUCK_ANDROID.name',
        avatar: '👸',
        avatarUrl: vanceAvatar,
        hp: 900,
        armor: 200,
        loreTitle: 'boss.LADY_LUCK_ANDROID.title',
        loreDesc: 'boss.LADY_LUCK_ANDROID.lore',
        specialAbility: 'boss.LADY_LUCK_ANDROID.ability',
        dialogueSet: [
          'boss.LADY_LUCK_ANDROID.dlg0',
          'boss.LADY_LUCK_ANDROID.dlg1',
          'boss.LADY_LUCK_ANDROID.dlg2'
        ]
      }
    ]
  },
  {
    id: 'VOID_CORE',
    name: 'loc.VOID_CORE.name',
    icon: '🌌',
    description: 'loc.VOID_CORE.desc',
    bgGradient: 'radial-gradient(circle at center, #231226 0%, #030105 100%)',
    bosses: [
      {
        id: 'GATEKEEPER_VOID',
        name: 'boss.GATEKEEPER_VOID.name',
        avatar: '👾',
        avatarUrl: oracleAvatar,
        hp: 1020,
        armor: 300,
        loreTitle: 'boss.GATEKEEPER_VOID.title',
        loreDesc: 'boss.GATEKEEPER_VOID.lore',
        specialAbility: 'boss.GATEKEEPER_VOID.ability',
        dialogueSet: [
          'boss.GATEKEEPER_VOID.dlg0',
          'boss.GATEKEEPER_VOID.dlg1',
          'boss.GATEKEEPER_VOID.dlg2'
        ]
      },
      {
        id: 'SHADOW_DESTINY',
        name: 'boss.SHADOW_DESTINY.name',
        avatar: '👤',
        avatarUrl: shadowAvatar,
        hp: 1140,
        armor: 300,
        loreTitle: 'boss.SHADOW_DESTINY.title',
        loreDesc: 'boss.SHADOW_DESTINY.lore',
        specialAbility: 'boss.SHADOW_DESTINY.ability',
        dialogueSet: [
          'boss.SHADOW_DESTINY.dlg0',
          'boss.SHADOW_DESTINY.dlg1',
          'boss.SHADOW_DESTINY.dlg2'
        ]
      },
      {
        id: 'LORD_OF_THE_VOID',
        name: 'boss.LORD_OF_THE_VOID.name',
        avatar: '👁️',
        avatarUrl: granddealerAvatar,
        hp: 1320,
        armor: 500,
        loreTitle: 'boss.LORD_OF_THE_VOID.title',
        loreDesc: 'boss.LORD_OF_THE_VOID.lore',
        specialAbility: 'boss.LORD_OF_THE_VOID.ability',
        dialogueSet: [
          'boss.LORD_OF_THE_VOID.dlg0',
          'boss.LORD_OF_THE_VOID.dlg1',
          'boss.LORD_OF_THE_VOID.dlg2'
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
  name: 'boss.TRAINING_DUMMY.name',
  avatar: '🎓',
  avatarUrl: ilshmonsterAvatar,
  // Deliberately soft: a first-timer playing badly still has to be able to win, because
  // the tutorial's payoff is the victory screen.
  hp: 40,
  loreTitle: 'boss.TRAINING_DUMMY.title',
  loreDesc: 'boss.TRAINING_DUMMY.lore',
  specialAbility: 'boss.TRAINING_DUMMY.ability',
  dialogueSet: [
    'boss.TRAINING_DUMMY.dlg0',
    'boss.TRAINING_DUMMY.dlg1',
    'boss.TRAINING_DUMMY.dlg2'
  ]
};

/**
 * Display-ready copy of a boss: the i18n keys in its text fields become text in the
 * player's language. Everything that shows a boss to the player goes through here, so a
 * raw key can never reach the screen.
 */
export function localizedBoss(def: BossDefinition): BossDefinition {
  return {
    ...def,
    name: t(def.name),
    loreTitle: t(def.loreTitle),
    loreDesc: t(def.loreDesc),
    specialAbility: t(def.specialAbility),
    dialogueSet: def.dialogueSet.map(key => t(key))
  };
}

/** Same for a location — only its name and blurb are ever shown. */
export function localizedLocation(def: LocationDefinition): LocationDefinition {
  return { ...def, name: t(def.name), description: t(def.description) };
}
