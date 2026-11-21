/** A link under a post's description. */
export interface PostLink {
  url: string;
  /** The author's name for it. Without one, the app shows the domain. */
  label?: string;
}

/** What a link shows: the author's name for it, or the site's domain without "www.". */
export function linkName(link: PostLink): string {
  if (link.label) {
    return link.label;
  }
  try {
    return new URL(link.url).hostname.replace(/^www\./, '');
  } catch {
    return link.url;
  }
}

/** The API takes only http and https, and people type "bilety.pl" more often than its scheme. */
export function linkUrl(typed: string): string {
  const url = typed.trim();
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
