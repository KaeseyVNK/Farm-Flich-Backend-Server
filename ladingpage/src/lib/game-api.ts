/** Public URLs only. The browser never receives the backend bridge token. */
export const GAME_API_BASE_URL = (
  process.env.NEXT_PUBLIC_GAME_API_URL ?? process.env.NEXT_PUBLIC_UNITY_SERVER_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

const GAME_URL = process.env.NEXT_PUBLIC_GAME_URL ?? process.env.NEXT_PUBLIC_UNITY_WEBGL_URL ?? "https://farmfilch.com/game/";

export function buildGameLaunchUrl(code: string, webOrigin: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(code)) throw new Error("Invalid launch code.");
  const game = new URL(GAME_URL);
  const web = new URL("/login", webOrigin);
  const api = new URL(GAME_API_BASE_URL);
  const loopback = (url: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const secure = (url: URL) => !url.username && !url.password &&
    (url.protocol === "https:" || (url.protocol === "http:" && loopback(url)));
  const sameHttpsHost = game.protocol === "https:" && web.protocol === "https:" && game.hostname === web.hostname;
  const localHttp = game.protocol === "http:" && web.protocol === "http:" && loopback(game) && loopback(web);
  if (![game, web, api].every(secure) || (!sameHttpsHost && !localHttp)) {
    throw new Error("The game and login addresses are not configured correctly.");
  }
  game.searchParams.set("server", GAME_API_BASE_URL);
  game.searchParams.delete("lc");
  game.searchParams.set("launchCode", code);
  game.searchParams.set("webLogin", web.toString());
  return game.toString();
}
