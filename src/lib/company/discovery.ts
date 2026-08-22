import { logger } from "@/lib/logger";

interface DiscoveryResult {
  name: string;
  domain: string;
  careersUrl: string;
}

const COMMON_CAREERS_PATHS = [
  "/careers",
  "/jobs",
  "/careers/",
  "/jobs/",
  "/about/careers",
  "/about/jobs",
  "/en/careers",
  "/en/jobs",
  "/join",
  "/join-us",
  "/work-with-us",
  "/hiring",
];

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function guessDomain(name: string): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
  const noSpaces = clean.replace(/\s+/g, "");
  return `${noSpaces}.com`;
}

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "ScrapeVerse/1.0" },
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function findCareersPage(domain: string): Promise<string | null> {
  const base = `https://${domain}`;

  // Try common careers paths
  for (const path of COMMON_CAREERS_PATHS) {
    const url = `${base}${path}`;
    const ok = await verifyUrl(url);
    if (ok) {
      logger.info("Found careers page", {
        operation: "discovery",
        careersUrl: url,
      });
      return url;
    }
  }

  // Try fetching homepage and looking for careers links
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(base, {
      signal: controller.signal,
      headers: { "User-Agent": "ScrapeVerse/1.0" },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const careersPatterns =
        /href=["']([^"']*(?:career|job|hiring|join|work-with)[^"']*?)["']/gi;
      const matches = [...html.matchAll(careersPatterns)];

      for (const match of matches) {
        let href = match[1];
        if (href.startsWith("/")) href = `${base}${href}`;
        if (href.startsWith("http")) {
          const ok = await verifyUrl(href);
          if (ok) {
            logger.info("Found careers page via link", {
              operation: "discovery",
              careersUrl: href,
            });
            return href;
          }
        }
      }
    }
  } catch (err) {
    logger.debug("Failed to fetch homepage for link discovery", {
      operation: "discovery",
      error: String(err),
    });
  }

  return null;
}

export async function discoverCompany(
  name: string,
  hintDomain?: string
): Promise<DiscoveryResult> {
  const start = Date.now();
  logger.info("Discovering company", { operation: "discovery", company: name, hintDomain });

  // If a domain hint is provided, try it first
  if (hintDomain) {
    const careersUrl = await findCareersPage(hintDomain);
    if (careersUrl) {
      logger.info("Company discovered (from domain hint)", {
        operation: "discovery",
        company: name,
        domain: hintDomain,
        careersUrl,
        duration_ms: Date.now() - start,
      });
      return { name, domain: hintDomain, careersUrl };
    }
  }

  const domain = hintDomain || guessDomain(name);
  const careersUrl = await findCareersPage(domain);

  if (!careersUrl) {
    // Try alternative domains
    const alternatives = [
      `${name.toLowerCase().replace(/\s+/g, "")}.io`,
      `${name.toLowerCase().replace(/\s+/g, "")}.co`,
      `${name.toLowerCase().replace(/\s+/g, "")}.tech`,
      `get${name.toLowerCase().replace(/\s+/g, "")}.com`,
      `${name.toLowerCase().replace(/\s+/g, "-")}.com`,
    ];

    for (const altDomain of alternatives) {
      const altCareers = await findCareersPage(altDomain);
      if (altCareers) {
        logger.info("Found careers on alternative domain", {
          operation: "discovery",
          company: name,
          domain: altDomain,
          duration_ms: Date.now() - start,
        });
        return { name, domain: altDomain, careersUrl: altCareers };
      }
    }

    throw new Error(
      `Could not find a careers page for "${name}". Tried ${domain} and alternatives. Please verify the company has a careers page.`
    );
  }

  logger.info("Company discovered", {
    operation: "discovery",
    company: name,
    domain,
    careersUrl,
    duration_ms: Date.now() - start,
  });

  return { name, domain, careersUrl };
}

export { normalizeCompanyName };
