/**
 * Pick which project slug to use for "new leave request" links:
 * current URL if it is under /projects/[slug]/..., otherwise first project.
 */
export function defaultProjectSlugForNewLeave(
  projects: readonly { slug: string }[],
  pathname: string | null
): string | null {
  if (projects.length === 0) return null;
  const match = pathname?.match(/^\/projects\/([^/]+)/);
  const fromPath = match?.[1];
  if (fromPath && projects.some((p) => p.slug === fromPath)) {
    return fromPath;
  }
  return projects[0].slug;
}
