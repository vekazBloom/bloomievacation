export function projectPath(slug: string, ...segments: string[]) {
  const encodedSlug = encodeURIComponent(slug);
  const encodedSegments = segments
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment));

  return `/projects/${[encodedSlug, ...encodedSegments].join('/')}`;
}
