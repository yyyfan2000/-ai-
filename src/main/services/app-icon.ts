import { nativeImage, NativeImage } from 'electron';

export function createFoxDockIcon(): NativeImage {
  const size = 512;
  const buffer = Buffer.alloc(size * size * 4);

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a = 255): void => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const index = (y * size + x) * 4;
    buffer[index] = b;
    buffer[index + 1] = g;
    buffer[index + 2] = r;
    buffer[index + 3] = a;
  };

  const fillEllipse = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: [number, number, number, number?],
  ): void => {
    const [r, g, b, a = 255] = color;
    for (let y = Math.max(0, cy - ry); y <= Math.min(size - 1, cy + ry); y += 1) {
      for (let x = Math.max(0, cx - rx); x <= Math.min(size - 1, cx + rx); x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) setPixel(x, y, r, g, b, a);
      }
    }
  };

  const fillPolygon = (points: Array<[number, number]>, color: [number, number, number, number?]): void => {
    const [r, g, b, a = 255] = color;
    const minY = Math.max(0, Math.min(...points.map((point) => point[1])));
    const maxY = Math.min(size - 1, Math.max(...points.map((point) => point[1])));

    for (let y = minY; y <= maxY; y += 1) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          intersections.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) {
        const startX = Math.max(0, Math.ceil(intersections[i]));
        const endX = Math.min(size - 1, Math.floor(intersections[i + 1]));
        for (let x = startX; x <= endX; x += 1) setPixel(x, y, r, g, b, a);
      }
    }
  };

  const fillRoundedSquare = (x: number, y: number, width: number, height: number, radius: number): void => {
    for (let py = y; py < y + height; py += 1) {
      for (let px = x; px < x + width; px += 1) {
        const dx = Math.max(x + radius - px, 0, px - (x + width - radius));
        const dy = Math.max(y + radius - py, 0, py - (y + height - radius));
        if (dx * dx + dy * dy <= radius * radius) setPixel(px, py, 255, 247, 237);
      }
    }
  };

  fillRoundedSquare(28, 28, 456, 456, 104);
  fillPolygon([[112, 106], [213, 190], [165, 265]], [249, 115, 22]);
  fillPolygon([[400, 106], [299, 190], [347, 265]], [249, 115, 22]);
  fillPolygon([[148, 128], [203, 193], [171, 226]], [31, 41, 55]);
  fillPolygon([[364, 128], [309, 193], [341, 226]], [31, 41, 55]);
  fillEllipse(256, 281, 156, 136, [251, 146, 60]);
  fillEllipse(207, 331, 74, 64, [255, 247, 237]);
  fillEllipse(305, 331, 74, 64, [255, 247, 237]);
  fillEllipse(256, 373, 112, 65, [255, 247, 237]);
  fillEllipse(199, 274, 21, 34, [17, 24, 39]);
  fillEllipse(313, 274, 21, 34, [17, 24, 39]);
  fillEllipse(256, 340, 30, 22, [17, 24, 39]);

  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}
