import type { CatalogItem, PantryItem } from '../types';

/** Catalog for search-when-adding only — never auto-added to the pantry. */
export const groceryCatalog: CatalogItem[] = [
  { name: 'Chicken thighs', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 4 },
  { name: 'Chicken breast', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 3 },
  { name: 'Ground turkey', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 2 },
  { name: 'Salmon fillet', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 2 },
  { name: 'Eggs', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 21 },
  { name: 'Whole milk', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 10 },
  { name: 'Greek yogurt', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 14 },
  { name: 'Butter', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 45 },
  { name: 'Cheddar cheese', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 28 },
  { name: 'Parmesan', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 60 },
  { name: 'Heavy cream', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 14 },
  { name: 'Spinach', store: 'Other', section: 'fresh', defaultDaysToExpire: 5 },
  { name: 'Baby arugula', store: 'Other', section: 'fresh', defaultDaysToExpire: 4 },
  { name: 'Romaine lettuce', store: 'Other', section: 'fresh', defaultDaysToExpire: 6 },
  { name: 'Broccoli', store: 'Other', section: 'fresh', defaultDaysToExpire: 7 },
  { name: 'Carrots', store: 'Other', section: 'fresh', defaultDaysToExpire: 21 },
  { name: 'Yellow onion', store: 'Other', section: 'fresh', defaultDaysToExpire: 30 },
  { name: 'Garlic', store: 'Other', section: 'fresh', defaultDaysToExpire: 30 },
  { name: 'Ginger', store: 'Other', section: 'fresh', defaultDaysToExpire: 14 },
  { name: 'Lemons', store: 'Other', section: 'fresh', defaultDaysToExpire: 14 },
  { name: 'Limes', store: 'Other', section: 'fresh', defaultDaysToExpire: 14 },
  { name: 'Avocados', store: 'Other', section: 'fresh', defaultDaysToExpire: 5 },
  { name: 'Cherry tomatoes', store: 'Other', section: 'fresh', defaultDaysToExpire: 7 },
  { name: 'Bell peppers', store: 'Other', section: 'fresh', defaultDaysToExpire: 8 },
  { name: 'Fresh basil', store: 'Other', section: 'fresh', defaultDaysToExpire: 5 },
  { name: 'Cilantro', store: 'Other', section: 'fresh', defaultDaysToExpire: 5 },
  { name: 'Parsley', store: 'Other', section: 'fresh', defaultDaysToExpire: 6 },
  { name: 'Mushrooms', store: 'Other', section: 'fresh', defaultDaysToExpire: 5 },
  { name: 'Frozen peas', store: 'Other', section: 'frozen', defaultDaysToExpire: 180 },
  { name: 'Sourdough bread', store: 'Other', section: 'fresh', defaultDaysToExpire: 4 },
  { name: 'Flour tortillas', store: 'Other', section: 'refrigerated', defaultDaysToExpire: 14 },
  { name: 'Jasmine rice', store: 'Other', section: 'dry', defaultDaysToExpire: 365 },
  { name: 'Pasta penne', store: 'Other', section: 'dry', defaultDaysToExpire: 730 },
  { name: 'Canned chickpeas', store: 'Other', section: 'dry', defaultDaysToExpire: 730 },
  { name: 'Canned black beans', store: 'Other', section: 'dry', defaultDaysToExpire: 730 },
  { name: 'Coconut milk', store: 'Other', section: 'dry', defaultDaysToExpire: 365 },
  { name: 'Soy sauce', store: 'Other', section: 'dry', defaultDaysToExpire: 730 },
  { name: 'Olive oil', store: 'Other', section: 'dry', defaultDaysToExpire: 540 },
  { name: 'Sesame oil', store: 'Other', section: 'dry', defaultDaysToExpire: 365 },
  { name: 'Hot sauce', store: 'Other', section: 'dry', defaultDaysToExpire: 730 },
  { name: 'Peanut butter', store: 'Other', section: 'dry', defaultDaysToExpire: 365 },
];

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function id(prefix: string, n: number): string {
  return `${prefix}-${n}`;
}

/**
 * Only basic spices are seeded. Purchase-history items are never invented —
 * they must come from a real store export or authenticated fetch.
 */
export function createBasicSpices(): PantryItem[] {
  const spices: Omit<PantryItem, 'id'>[] = [
    {
      name: 'Kosher salt',
      store: 'Staple',
      section: 'dry',
      quantity: '1 box',
      purchasedAt: daysFromToday(-120),
      expiresAt: daysFromToday(900),
      isStaple: true,
    },
    {
      name: 'Black pepper',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-120),
      expiresAt: daysFromToday(700),
      isStaple: true,
    },
    {
      name: 'Garlic powder',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-200),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
    {
      name: 'Onion powder',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-200),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
    {
      name: 'Paprika',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-180),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
    {
      name: 'Cumin',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-180),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
    {
      name: 'Dried oregano',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-200),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
    {
      name: 'Dried thyme',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-200),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
    {
      name: 'Red pepper flakes',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-200),
      expiresAt: daysFromToday(500),
      isStaple: true,
    },
    {
      name: 'Bay leaves',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-200),
      expiresAt: daysFromToday(500),
      isStaple: true,
    },
    {
      name: 'Cinnamon',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-200),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
    {
      name: 'Chili powder',
      store: 'Staple',
      section: 'dry',
      quantity: '1 jar',
      purchasedAt: daysFromToday(-180),
      expiresAt: daysFromToday(400),
      isStaple: true,
    },
  ];

  return spices.map((s, i) => ({ ...s, id: id('spice', i + 1) }));
}

/** @deprecated Use createBasicSpices — no purchase history is invented. */
export function createPurchaseHistorySeed(): PantryItem[] {
  return [];
}

/** @deprecated Non-spice staples are no longer auto-seeded. */
export function createDryGoodsStaples(): PantryItem[] {
  return createBasicSpices();
}

export function createInitialPantry(): PantryItem[] {
  return createBasicSpices();
}
