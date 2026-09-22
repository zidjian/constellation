// Del perfil de Discord guardamos solo esto (invariante: nunca tokens).
export interface User {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string | null;
}

export interface DiscordProfile {
  discordId: string;
  username: string;
  avatarUrl: string | null;
}
