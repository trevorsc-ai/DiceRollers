export interface TwinsiesEvent {
  key: string;
  roll_date: string;
  red: number;
  white: number;
  partners: string[];
  roll_id: number;
}

export interface TwinsiesProgressDetail {
  credited_events: TwinsiesEvent[];
}

export function formatPartners(usernames: string[]): string {
  if (!usernames.length) return "";
  if (usernames.length === 1) return `@${usernames[0]}`;
  if (usernames.length === 2) return `@${usernames[0]} & @${usernames[1]}`;
  const last = usernames[usernames.length - 1];
  return usernames.slice(0, -1).map((u) => `@${u}`).join(", ") + `, and @${last}`;
}

export function twinEventKey(rollDate: string, red: number, white: number): string {
  return `${rollDate}|${red}|${white}`;
}
