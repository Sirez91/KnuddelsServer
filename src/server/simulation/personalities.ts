export type PersonalityId =
  | 'plauderer'
  | 'stammgast'
  | 'stiller'
  | 'newbie'
  | 'flirter'
  | 'troll'
  | 'spammer';

export type Personality = {
  id: PersonalityId;
  label: string;
  /** Group label shown in UI. */
  category: 'normal' | 'troublemaker';
  /** Probability per tick (1s) that this user posts a message while active. */
  chatPerSec: number;
  /** Minimum seconds between two messages from the same user. */
  minMessageGapSec: number;
  /** Probability per tick that this user leaves on their own. */
  leavePerSec: number;
  /** Mean dwell time in channel in seconds — used to scale leavePerSec gracefully. */
  meanStaySec: number;
  /** If true, sometimes prefixes messages with "@<otherNick>" to look like a reply. */
  repliesToOthers: boolean;
  /** A bank of message templates. {nick} is replaced with another user's nick if available. */
  phrases: string[];
  /** Optional bank of greetings (used when joining). */
  greetings?: string[];
  /** Optional bank of farewells (used when leaving). */
  farewells?: string[];
};

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  plauderer: {
    id: 'plauderer',
    label: 'Plauderer',
    category: 'normal',
    chatPerSec: 0.04,
    minMessageGapSec: 12,
    leavePerSec: 1 / 600,
    meanStaySec: 600,
    repliesToOthers: true,
    greetings: ['Hi zusammen :)', 'Hallöchen!', 'Moin moin', 'Huhu', 'Servus alle'],
    farewells: ['Muss los, bis später!', 'Gute Nacht euch', 'Bin dann mal weg', 'Tschüssi'],
    phrases: [
      'Wie geht es euch heute?',
      'Hat jemand das Wetter draußen gesehen?',
      'Bin gerade beim Kaffee, einer mit?',
      '@{nick} stimmt total',
      'Was macht ihr so am Wochenende?',
      'Ich hatte heute echt einen langen Tag',
      'Lustig dass das gerade Thema ist',
      'Endlich Feierabend hier',
      '@{nick} das sehe ich genauso',
      'Hmm interessant',
    ],
  },
  stammgast: {
    id: 'stammgast',
    label: 'Stammgast',
    category: 'normal',
    chatPerSec: 0.05,
    minMessageGapSec: 10,
    leavePerSec: 1 / 1500,
    meanStaySec: 1500,
    repliesToOthers: true,
    greetings: ['Na, schon alle da?', 'Wieder die alte Truppe ;)', 'Hi Leute!'],
    farewells: ['Ciao, bis morgen!', 'Machts gut', 'Bin raus, schönen Abend'],
    phrases: [
      'Wie immer wenig los um die Zeit',
      '@{nick} das hattest du letztens auch schon erzählt :)',
      'Erinnert ihr euch noch an damals?',
      'Bei mir war heute wieder das volle Programm',
      'Ich glaube wir kennen uns alle schon zu gut',
      '@{nick} hahaha typisch',
      'Hat jemand was Neues?',
      'Ach komm, das war doch klar',
      'Ich bleibe noch ein bisschen',
    ],
  },
  stiller: {
    id: 'stiller',
    label: 'Stiller Beobachter',
    category: 'normal',
    chatPerSec: 0.005,
    minMessageGapSec: 60,
    leavePerSec: 1 / 200,
    meanStaySec: 200,
    repliesToOthers: false,
    greetings: ['Hi', 'hallo', 'Moin'],
    farewells: ['cu', 'tschö', 'bb'],
    phrases: ['hm', 'ja', 'okay', 'mhm', 'verstehe', 'jo'],
  },
  newbie: {
    id: 'newbie',
    label: 'Newbie',
    category: 'normal',
    chatPerSec: 0.05,
    minMessageGapSec: 12,
    leavePerSec: 1 / 400,
    meanStaySec: 400,
    repliesToOthers: false,
    greetings: ['Hallo, bin neu hier!', 'Hi, das ist mein erstes Mal :)', 'Huhu, wie funktioniert das hier?'],
    farewells: ['Danke euch, bis bald!', 'War schön, ciao'],
    phrases: [
      'Wie alt seid ihr alle so?',
      'Worüber redet ihr gerade?',
      'Kann mir wer den Channel erklären?',
      'Sorry wenn ich Fragen stelle',
      'Bin noch ganz neu, bitte nicht hauen',
      'Wo kommt ihr alle her?',
      'Wie kann man hier ein Foto setzen?',
      'Ist hier immer so wenig los?',
    ],
  },
  flirter: {
    id: 'flirter',
    label: 'Flirter',
    category: 'normal',
    chatPerSec: 0.04,
    minMessageGapSec: 14,
    leavePerSec: 1 / 800,
    meanStaySec: 800,
    repliesToOthers: true,
    greetings: ['Na ihr Hübschen ;)', 'Hi süße Leute', 'Hallooooo zusammen'],
    farewells: ['Träumt was Schönes', 'Bis bald, Küsschen', 'Schlaft gut <3'],
    phrases: [
      '@{nick} cooler Nick übrigens',
      'Sind hier noch nette Leute aus meiner Gegend?',
      'Was macht ihr so wenn ihr nicht chattet?',
      '@{nick} klingst sympathisch',
      'Lust auf ein nettes Gespräch?',
      'Wer hat noch nicht geschlafen heute?',
      'Erzähl mal was über dich',
    ],
  },
  troll: {
    id: 'troll',
    label: 'Störer / Troll',
    category: 'troublemaker',
    chatPerSec: 0.1,
    minMessageGapSec: 6,
    leavePerSec: 1 / 300,
    meanStaySec: 300,
    repliesToOthers: true,
    greetings: ['was geht ab du penner', 'ALDER ich bin wieder da', 'na ihr lappen'],
    farewells: ['lol langweilig hier, bin raus', 'flop chat ciao'],
    phrases: [
      'BORING hier',
      '@{nick} bist du dumm oder was',
      'haha was für ein flop chat',
      'WER WILL MAL RICHTIG STREIT',
      '@{nick} hör auf so einen unsinn zu schreiben',
      'mod wo bist du LOL',
      'ALLES MÜLL HIER',
      'können die hier nicht reden??',
      'cringe',
      '@{nick} okay boomer',
    ],
  },
  spammer: {
    id: 'spammer',
    label: 'Spammer',
    category: 'troublemaker',
    chatPerSec: 0.18,
    minMessageGapSec: 4,
    leavePerSec: 1 / 250,
    meanStaySec: 250,
    repliesToOthers: false,
    greetings: ['HEY HEY HEY', 'JOIN MEINEN CHANNEL!!!', '!!!!!!!'],
    farewells: ['BYE BYE BYE'],
    phrases: [
      'kommt alle in meinen channel!!!',
      'aaaaaaaaaaa',
      'lololololol',
      '!!!!!!!!!!!!',
      '😂😂😂😂😂😂',
      'klick mein profil ;)',
      'JOIN JOIN JOIN',
      'SPAM SPAM SPAM',
      'lol lol lol lol lol',
    ],
  },
};

export const NICK_POOL = [
  'Lisa', 'Max', 'Sophie', 'Tim', 'Lena', 'Jonas', 'Mia', 'Paul', 'Hannah', 'Felix',
  'Emma', 'Leon', 'Marie', 'Lukas', 'Laura', 'Niklas', 'Sarah', 'Tom', 'Julia', 'Ben',
  'Anna2', 'Klausi', 'PinkPanther', 'NightOwl', 'SunnyD', 'DerKai', 'KleineMaus',
  'Schnuffel', 'Crazy88', 'Toni', 'Rene', 'Vivi', 'Yuki', 'Noah', 'Elias', 'Ella',
  'Mara', 'Nele', 'Pia', 'Ronja', 'Theo', 'Henri', 'Joschi', 'Mike', 'Conny',
];

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function renderPhrase(template: string, otherNick: string | null): string {
  if (!template.includes('{nick}')) return template;
  if (!otherNick) {
    return template.replace(/^@\{nick\}\s*/, '').replace(/\{nick\}/g, 'jemand');
  }
  return template.replace(/\{nick\}/g, otherNick);
}
