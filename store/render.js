// Rasterize a mockup element to a PNG data URL at its exact CSS size (SVG foreignObject -> canvas).
window.renderMockup = async function renderMockup(id) {
  await window.mockupsReady;
  const node = document.getElementById(id);
  const { width, height } = node.getBoundingClientRect();
  const css = document.getElementById('mock-css').textContent;
  const html = new XMLSerializer().serializeToString(node);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css}</style>${html}</div></foreignObject></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
};
