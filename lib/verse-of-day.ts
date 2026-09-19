export type DailyVerse = {
  reference: string;
  text: string;
  translation: string;
};

const verses: DailyVerse[] = [
  {
    reference: "Genesis 1:1",
    text: "In the beginning, God created the heavens and the earth.",
    translation: "WEB British Edition",
  },
  {
    reference: "Psalm 23:1",
    text: "The LORD is my shepherd; I shall lack nothing.",
    translation: "WEB British Edition",
  },
  {
    reference: "Proverbs 3:5–6",
    text: "Trust in the LORD with all your heart, and don’t lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.",
    translation: "WEB British Edition",
  },
  {
    reference: "Joshua 1:9",
    text: "Haven’t I commanded you? Be strong and courageous. Don’t be afraid. Don’t be dismayed, for the LORD your God is with you wherever you go.",
    translation: "WEB British Edition",
  },
  {
    reference: "Matthew 6:33",
    text: "But seek first God’s Kingdom and his righteousness; and all these things will be given to you as well.",
    translation: "WEB British Edition",
  },
  {
    reference: "John 3:16",
    text: "For God so loved the world, that he gave his only born Son, that whoever believes in him should not perish, but have eternal life.",
    translation: "WEB British Edition",
  },
  {
    reference: "Romans 8:28",
    text: "We know that all things work together for good for those who love God, for those who are called according to his purpose.",
    translation: "WEB British Edition",
  },
  {
    reference: "Psalm 46:1",
    text: "God is our refuge and strength, a very present help in trouble.",
    translation: "WEB British Edition",
  },
];

function londonDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateHash(value: string) {
  return [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0);
}

export function getVerseOfTheDay(date = new Date()) {
  const dateKey = londonDateKey(date);
  const verse = verses[dateHash(dateKey) % verses.length];

  return { ...verse, dateKey };
}
