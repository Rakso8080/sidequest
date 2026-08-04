import type { Lang } from "./i18n";

export interface TermsSection {
  title: string;
  body: string;
}

const en: TermsSection[] = [
  {
    title: "Use at your own risk",
    body: "SideQuest is a fun accountability game between friends. You choose the quests. Every quest, challenge and punishment is organised by you and your group. The app does not force you to do anything, and you are always free to decline or stop. By using the app you accept that you take part voluntarily and at your own risk.",
  },
  {
    title: "No professional advice",
    body: "Nothing in SideQuest is medical, financial, legal or other professional advice. If a quest touches your health, safety, money or legal obligations, you decide — and we recommend you talk to a professional first.",
  },
  {
    title: "You are responsible for your actions",
    body: "You are solely responsible for what you do to complete a quest and for the consequences of your own actions. SideQuest is not responsible for injuries, damages, losses or anything else caused by you, your group, or the quests you take part in.",
  },
  {
    title: "Be sensible and legal",
    body: "Never do anything illegal, dangerous, reckless or that harms others. Do not create or accept quests that involve breaking the law, damaging property, endangering people or animals, or that could embarrass or hurt someone. Content that is illegal, hateful, harassing or explicit is not allowed.",
  },
  {
    title: "No guarantee of service or data",
    body: "The app is provided 'as is' and without any guarantees. It may be unavailable, slow or change at any time. We do not guarantee that your data (accounts, points, photos) is kept forever, so keep your own copies of anything important.",
  },
  {
    title: "Your content",
    body: "You keep ownership of the photos and text you upload. By uploading them you let us store and show them to your group so the app can work. Only your group can see your proof — unless you share it elsewhere yourself.",
  },
  {
    title: "Minors",
    body: "If you are under 16, ask your parents or guardians before using the app. The person responsible for a minor account is the parent or guardian.",
  },
  {
    title: "Contact",
    body: "Questions? You can reach the app's owner through the profile page. We'll do our best to help.",
  },
];

const no: TermsSection[] = [
  {
    title: "Bruk på eige ansvar",
    body: "SideQuest er eit morosamt ansvarsspel mellom venner. Du vel sjølv kva oppdrag du tek. Kvart oppdrag, utfordring og straff er organisert av deg og gruppa di. Appen tvingar deg aldri til noko, og du kan når som helst takke nei eller slutte. Ved å bruke appen godtek du at du deltek frivillig og på eige ansvar.",
  },
  {
    title: "Ingen profesjonell rådgiving",
    body: "Ingenting i SideQuest er medisinsk, økonomisk, juridisk eller anna profesjonell rådgiving. Dersom eit oppdrag gjeld helsa di, tryggleiken, pengane eller juridiske plikter, er det du som bestemmer — og vi tilrår å snakke med ein fagperson først.",
  },
  {
    title: "Du er ansvarleg for det du gjer",
    body: "Du er sjølv ansvarleg for det du gjer for å fullføre eit oppdrag og for konsekvensane av dine eigne handlingar. SideQuest er ikkje ansvarleg for skader, tap eller anna som skuldast deg, gruppa di eller oppdraga du deltek i.",
  },
  {
    title: "Vær fornuftig og lovleg",
    body: "Gjer aldri noko ulovleg, farleg, ubetenksamt eller som skader andre. Lag eller godta ikkje oppdrag som bryt lova, øydelegg eigedom, set folk eller dyr i fare, eller som kan krenkje eller skade nokon. Innhald som er ulovleg, hatefullt, trakasserande eller eksplisitt er ikkje tillate.",
  },
  {
    title: "Ingen garanti for teneste eller data",
    body: "Appen blir levert «som ho er» og utan garantiar. Ho kan vere utilgjengeleg, treg eller endre seg når som helst. Vi garanterer ikkje at dataa dine (kontoar, poeng, bilete) blir bevart for alltid — ta eigne kopiar av det som er viktig.",
  },
  {
    title: "Innhaldet ditt",
    body: "Du eig bileta og teksten du lastar opp. Ved å laste dei opp gjev du oss lov til å lagre og vise dei til gruppa di så appen kan fungere. Berre gruppa di ser bevisa dine — med mindre du deler dei andre stader sjølv.",
  },
  {
    title: "Mindreårige",
    body: "Er du under 16 år, spør foreldra eller føresette før du brukar appen. Den som er ansvarleg for ein mindreårig konto, er foreldra eller føresette.",
  },
  {
    title: "Kontakt",
    body: "Spørsmål? Du når eigaren av appen gjennom profilsida. Vi gjer vårt beste for å hjelpe.",
  },
];

const de: TermsSection[] = [
  {
    title: "Nutzung auf eigene Gefahr",
    body: "SideQuest ist ein spaßiges Verantwortungsspiel zwischen Freunden. Du wählst die Aufgaben selbst. Jede Aufgabe, Herausforderung und Strafe wird von dir und deiner Gruppe organisiert. Die App zwingt dich zu nichts, und du kannst jederzeit ablehnen oder aufhören. Mit der Nutzung der App erklärst du dich damit einverstanden, freiwillig und auf eigene Gefahr teilzunehmen.",
  },
  {
    title: "Keine professionelle Beratung",
    body: "Nichts in SideQuest ist medizinische, finanzielle, rechtliche oder andere professionelle Beratung. Wenn eine Aufgabe Gesundheit, Sicherheit, Geld oder rechtliche Pflichten betrifft, entscheidest du — und wir empfehlen, zuerst einen Fachmann zu konsultieren.",
  },
  {
    title: "Du bist für dein Handeln verantwortlich",
    body: "Du bist allein verantwortlich für das, was du tust, um eine Aufgabe zu erfüllen, und für die Folgen deiner eigenen Handlungen. SideQuest haftet nicht für Verletzungen, Schäden oder Verluste, die durch dich, deine Gruppe oder die Aufgaben verursacht werden.",
  },
  {
    title: "Vernünftig und legal bleiben",
    body: "Tue niemals etwas Illegales, Gefährliches, Unüberlegtes oder das anderen schadet. Erstelle oder akzeptiere keine Aufgaben, die gegen das Gesetz verstoßen, Eigentum beschädigen, Menschen oder Tiere gefährden oder jemanden bloßstellen. Illegale, hasserfüllte, belästigende oder explizite Inhalte sind nicht erlaubt.",
  },
  {
    title: "Keine Garantie für Dienst oder Daten",
    body: "Die App wird „wie besehen“ ohne Garantien bereitgestellt. Sie kann jederzeit nicht verfügbar sein, langsam sein oder sich ändern. Wir garantieren nicht, dass deine Daten (Konten, Punkte, Fotos) für immer erhalten bleiben — sichere selbst alles Wichtige.",
  },
  {
    title: "Deine Inhalte",
    body: "Du behältst das Eigentum an den Fotos und Texten, die du hochlädst. Durch das Hochladen erlaubst du uns, sie zu speichern und deiner Gruppe zu zeigen, damit die App funktioniert. Nur deine Gruppe kann deine Beweise sehen — es sei denn, du teilst sie selbst woanders.",
  },
  {
    title: "Minderjährige",
    body: "Wenn du unter 16 bist, frage deine Eltern oder Erziehungsberechtigten, bevor du die App nutzt. Für ein Minderjährigen-Konto ist der Elternteil oder Erziehungsberechtigte verantwortlich.",
  },
  {
    title: "Kontakt",
    body: "Fragen? Du erreichst den Eigentümer der App über die Profilseite. Wir helfen gerne weiter.",
  },
];

export const TERMS: Record<Lang, TermsSection[]> = { en, no, de };
