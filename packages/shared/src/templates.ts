// Ready-made bills (what she is asking for) and relationships (who she is asking).
// The two combine to pre-fill a bill and write the WhatsApp message for her.

export type TemplateGroup = "beauty" | "lifestyle" | "dates" | "occasions" | "essentials" | "other";

export interface BillTemplate {
  id: string;
  label: string;
  emoji: string;
  group: TemplateGroup;
  /** Pre-filled bill title. */
  title: string;
  /** Short line used in the share message, e.g. "my hair appointment". */
  phrase: string;
}

export const TEMPLATE_GROUPS: { id: TemplateGroup; label: string }[] = [
  { id: "beauty", label: "Beauty" },
  { id: "lifestyle", label: "Shopping & lifestyle" },
  { id: "dates", label: "Dates & outings" },
  { id: "occasions", label: "Special days" },
  { id: "essentials", label: "Essentials" },
  { id: "other", label: "Anything else" },
];

export const BILL_TEMPLATES: BillTemplate[] = [
  { id: "hair", label: "Hair", emoji: "💇🏾‍♀️", group: "beauty", title: "Hair appointment", phrase: "my hair appointment" },
  { id: "nails", label: "Nails", emoji: "💅🏾", group: "beauty", title: "Nails", phrase: "my nails" },
  { id: "skincare", label: "Skincare", emoji: "🧴", group: "beauty", title: "Skincare restock", phrase: "my skincare" },
  { id: "beauty", label: "Makeup & beauty", emoji: "💄", group: "beauty", title: "Makeup and beauty", phrase: "my makeup and beauty" },
  { id: "perfume", label: "Perfume", emoji: "🌸", group: "beauty", title: "Perfume", phrase: "a new perfume" },
  { id: "shopping", label: "Shopping allowance", emoji: "🛍️", group: "lifestyle", title: "Shopping allowance", phrase: "my shopping" },
  { id: "fashion", label: "Fashion & clothes", emoji: "👗", group: "lifestyle", title: "New clothes", phrase: "some new clothes" },
  { id: "bags-shoes", label: "Bags & shoes", emoji: "👠", group: "lifestyle", title: "Bag and shoes", phrase: "a bag and shoes" },
  { id: "gadgets", label: "Phone & gadgets", emoji: "📱", group: "lifestyle", title: "Phone and gadgets", phrase: "a new gadget" },
  { id: "food", label: "Food & lunch", emoji: "🍲", group: "dates", title: "Food and lunch", phrase: "my food" },
  { id: "dinner", label: "Dinner date", emoji: "🍽️", group: "dates", title: "Dinner date", phrase: "our dinner date" },
  { id: "cinema", label: "Cinema date", emoji: "🎬", group: "dates", title: "Cinema date", phrase: "our cinema date" },
  { id: "hotel", label: "Hotel", emoji: "🏨", group: "dates", title: "Hotel booking", phrase: "the hotel booking" },
  { id: "travel", label: "Travel", emoji: "✈️", group: "dates", title: "Travel", phrase: "my trip" },
  { id: "valentine", label: "Valentine's", emoji: "💝", group: "occasions", title: "Valentine's Day", phrase: "Valentine's" },
  { id: "anniversary", label: "Anniversary", emoji: "🥂", group: "occasions", title: "Anniversary gift", phrase: "our anniversary" },
  { id: "birthday", label: "Birthday", emoji: "🎂", group: "occasions", title: "Birthday", phrase: "my birthday" },
  { id: "upkeep", label: "Monthly upkeep", emoji: "🗓️", group: "essentials", title: "Monthly upkeep", phrase: "my upkeep this month" },
  { id: "data-airtime", label: "Data & airtime", emoji: "📶", group: "essentials", title: "Data and airtime", phrase: "my data and airtime" },
  { id: "subscriptions", label: "Subscriptions", emoji: "📺", group: "essentials", title: "Subscriptions", phrase: "my subscriptions" },
  { id: "rent", label: "Rent", emoji: "🏠", group: "essentials", title: "Rent", phrase: "my rent" },
  { id: "school-fees", label: "School fees", emoji: "🎓", group: "essentials", title: "School fees", phrase: "my school fees" },
  { id: "medical", label: "Medical", emoji: "🩺", group: "essentials", title: "Medical bill", phrase: "my medical bill" },
  { id: "emergency", label: "Emergency", emoji: "🚨", group: "essentials", title: "Emergency", phrase: "an emergency" },
  { id: "savings", label: "Savings", emoji: "🐷", group: "essentials", title: "Savings contribution", phrase: "my savings" },
  { id: "custom", label: "Custom bill", emoji: "✍🏾", group: "other", title: "", phrase: "this" },
];

export type Relationship = "partner" | "husband" | "dating" | "admirer" | "long-distance" | "friend" | "family" | "other";

export interface RelationshipOption {
  id: Relationship;
  label: string;
  greeting: string;
  closing: string;
}

export const RELATIONSHIPS: RelationshipOption[] = [
  { id: "partner", label: "Boyfriend / partner", greeting: "Hey baby", closing: "Thank you my love ❤️" },
  { id: "husband", label: "Husband", greeting: "Hello my husband", closing: "Love you always ❤️" },
  { id: "dating", label: "Someone I'm dating", greeting: "Hey you", closing: "You're the best 😊" },
  { id: "admirer", label: "Admirer", greeting: "Hi", closing: "I'd really appreciate it 😊" },
  { id: "long-distance", label: "Long-distance partner", greeting: "Hey love, miss you", closing: "Can't wait to see you ❤️" },
  { id: "friend", label: "Friend", greeting: "Hey", closing: "Thank you so much 🙏🏾" },
  { id: "family", label: "Family", greeting: "Hello", closing: "Thank you, God bless 🙏🏾" },
  { id: "other", label: "Someone else", greeting: "Hi", closing: "Thank you 🙏🏾" },
];

export function getTemplate(id: string | null | undefined): BillTemplate {
  return BILL_TEMPLATES.find((t) => t.id === id) ?? BILL_TEMPLATES[BILL_TEMPLATES.length - 1];
}

export function getRelationship(id: string | null | undefined): RelationshipOption {
  return RELATIONSHIPS.find((r) => r.id === id) ?? RELATIONSHIPS[RELATIONSHIPS.length - 1];
}

/** Writes the ready-to-send WhatsApp message for a bill. */
export function buildShareMessage(opts: {
  category: string;
  relationship: string;
  recipientName?: string | null;
  title: string;
  amount: string;
  link: string;
}): string {
  const template = getTemplate(opts.category);
  const rel = getRelationship(opts.relationship);
  const name = opts.recipientName?.trim();
  const greeting = name ? `${rel.greeting} ${name}` : rel.greeting;
  const what = template.id === "custom" ? `"${opts.title}"` : template.phrase;
  return [
    `${greeting} ${template.emoji}`,
    `I need ${opts.amount} for ${what}. You can pay with bank transfer, card or USSD here:`,
    opts.link,
    rel.closing,
  ].join("\n\n");
}
