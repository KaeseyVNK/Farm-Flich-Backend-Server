const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://farmfilch.com";

export function JsonLd() {
  const videoGame = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Farm & Filch",
    url: siteUrl,
    image: `${siteUrl}/images/farm-filch-hero.png`,
    description: "A free-to-play browser pixel farm RPG where players grow a farm, guard their harvest, and filch from neighboring farms.",
    genre: ["Farming Simulation", "Role-Playing Game", "Pixel Art"],
    gamePlatform: "Web Browser",
    playMode: "MultiPlayer",
    applicationCategory: "Game",
    operatingSystem: "Web Browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoGame) }} />;
}
