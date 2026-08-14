// Browser-only colour helpers for the draft board. Imported by client
// components only — sampleLogoColor touches document/Image.
//
// Every team logo is a 1080x1080 PNG with a solid-colour background, and that
// colour is NOT reliably team.primary (Brownlowrowbottom's artwork uses its
// secondary, as does Dalts). So the board samples the artwork itself: paint a
// surface with the pixel the logo actually starts with and the logo blends in
// exactly, with no seam, for every team.

const logoColorCache = new Map<string, string>();

export function sampleLogoColor(src: string): Promise<string | null> {
  const cached = logoColorCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        // Just inside the top-left corner: background on every current logo
        // (Lucky Bison's photo reaches the bottom corners, so avoid those).
        ctx.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
        logoColorCache.set(src, hex);
        resolve(hex);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function isDark(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}
