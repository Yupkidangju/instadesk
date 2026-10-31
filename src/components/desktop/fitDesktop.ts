export function fitDesktop(sourceWidth: number, sourceHeight: number, viewportWidth: number, viewportHeight: number) {
  const width = Math.max(1, sourceWidth);
  const height = Math.max(1, sourceHeight);
  const scale = viewportWidth > 0 && viewportHeight > 0
    ? Math.min(viewportWidth / width, viewportHeight / height)
    : 1;
  return { scale, width: width * scale, height: height * scale };
}
