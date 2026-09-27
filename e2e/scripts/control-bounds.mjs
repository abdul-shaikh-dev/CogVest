export function inspectControlBounds(xml, { testId, expectedLabel, screen }) {
  if (screen.density <= 0 || screen.width <= 0 || screen.height <= 0) {
    throw new Error("Invalid display geometry");
  }
  const scale = screen.density / 160;
  const matches = [...xml.matchAll(/<node\b[^>]*>/g)].map(([node]) =>
    Object.fromEntries([...node.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]))
  ).filter((node) => node["resource-id"] === testId || node["resource-id"]?.endsWith(`:id/${testId}`));
  if (matches.length !== 1) throw new Error(`Expected one ${testId}; found ${matches.length}`);
  const node = matches[0];
  const bounds = node.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  if (!bounds) throw new Error(`Missing bounds for ${testId}`);
  const [, left, top, right, bottom] = bounds.map(Number);
  const report = {
    testId, label: node["content-desc"], screen,
    bounds: { left, top, right, bottom },
    widthDp: (right - left) / scale, heightDp: (bottom - top) / scale,
    minimumDp: 48, horizontalInsetDp: 16,
  };
  const errors = [];
  if (report.label !== expectedLabel) errors.push(`Expected label ${expectedLabel}`);
  if (node.clickable !== "true" || node.enabled !== "true") errors.push("Control is not enabled/clickable");
  if (report.widthDp < 48 || report.heightDp < 48) errors.push("Visible control is smaller than 48dp");
  if (left < 16 * scale || right > screen.width - 16 * scale || top < 0 || bottom > screen.height) {
    errors.push("Control extends outside the screen's 16dp content inset");
  }
  return { ...report, errors };
}
