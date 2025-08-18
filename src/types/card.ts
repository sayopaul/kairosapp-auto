export interface TransformedCard {
  id: string;
  name: string;
  set: string;
  card_number: string;
  rarity: string;
  market_price: number;
  image_url: string;
  source?: string; // Optional source field to track which service provided the card
}
