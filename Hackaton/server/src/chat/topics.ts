import { TOPIC_IDS, type StudentProfile, type TopicId } from '../../../shared/types.js';

export interface TopicScript {
  /** Altijd precies één vraag. */
  question: string;
  /** Hulpvraag als de student twijfelt of het niet weet. */
  help: string;
  /** Doorvraag als het antwoord maar één woord is (alleen bij open onderwerpen). */
  elaborate?: string;
  /** Vervolgvraag binnen hetzelfde onderwerp, overgeslagen als het antwoord er al op ingaat. */
  second?: { question: string; skipIf: RegExp };
}

export const TOPIC_SCRIPTS: Record<TopicId, TopicScript> = {
  interesses: {
    question: 'Waar ben je in je vrije tijd graag mee bezig?',
    help: 'Geen probleem. Denk bijvoorbeeld aan sport, muziek, techniek, mensen helpen, reizen of gamen. Waar word je enthousiast van?',
    elaborate: 'Wat spreekt je daar vooral in aan?',
  },
  opleiding: {
    question: 'Welke opleiding doe je nu?',
    help: 'Noem gerust alleen de naam van je huidige hbo-opleiding. Wat studeer je nu?',
    second: {
      question: 'Heb je daarvoor nog een andere opleiding gedaan, bijvoorbeeld op het mbo of aan een andere hogeschool?',
      skipIf: /\b(daarvoor|eerder|vroeger|hiervoor|mbo|havo|vwo|bachelor|master|propedeuse|gestopt|geswitcht|overgestapt)\b/i,
    },
  },
  vakken: {
    question: 'Welke vakken of projecten uit je studie vond je het leukst?',
    help: 'Denk aan een project, vak of opdracht die je energie gaf of waar je trots op bent. Wat was dat?',
  },
  werkervaring: {
    question: 'Heb je werkervaring, bijvoorbeeld een bijbaan, stage of vrijwilligerswerk?',
    help: 'Ook een bijbaan in de supermarkt of vrijwilligerswerk telt mee. Wat voor werk heb je gedaan?',
    second: {
      question: 'Welke vaardigheden heb je daar opgedaan, of waar ben je goed in?',
      skipIf: /\b(geleerd|vaardighe|goed in|ervaring met|skills|kan ik)\b/i,
    },
  },
  ambities: {
    question: 'Wat wil je na je studie gaan doen?',
    help: 'Dat hoeft nog niet vast te staan. Zie je jezelf later eerder werken met mensen, met techniek, creatief, in een bedrijf of in de zorg?',
  },
  voorkeuren: {
    question: 'Wat zou je in een minor graag willen ontdekken of leren?',
    help: 'Wil je je verdiepen in je eigen vakgebied, of juist iets heel anders proberen? Noem gerust een onderwerp waar je nieuwsgierig naar bent.',
    second: {
      question: 'Is er ook iets wat je in een minor juist niet wilt?',
      skipIf: /\b(niet|niets|niks|geen|liever niet|hekel|vermijden)\b/i,
    },
  },
};

export const GREETING =
  'Hoi! Ik ben een AI-assistent, dus geen mens. Ik help je minoren te vinden die bij je passen, met gegevens van Kies op Maat. ' +
  'Ik stel je een paar korte vragen, steeds één tegelijk. Je kunt praten of typen, en ons gesprek wordt niet opgeslagen.';

export function nextOpenTopic(profile: StudentProfile): TopicId | null {
  return TOPIC_IDS.find((id) => profile.topics[id].status === 'open') ?? null;
}

export const CLOSING =
  'Dank je wel, ik heb genoeg informatie. Ik zet de minoren die bij je passen op een rij, van beste naar minder goede match.';
