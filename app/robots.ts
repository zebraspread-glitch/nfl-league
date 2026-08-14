import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Belt and braces alongside the noindex metadata and the middleware gate.
      disallow: "/admin",
    },
  };
}
