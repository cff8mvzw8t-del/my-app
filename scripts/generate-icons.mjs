// Dependency-free rasterization of a geometric fox icon for iOS Home Screen.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
const crc32 = data => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const label = Buffer.from(type);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([label, data])));
  return Buffer.concat([size, label, data, crc]);
}
const points = [[.23,.24],[.44,.37],[.56,.37],[.77,.24],[.73,.59],[.5,.79],[.27,.59],[.23,.24]];
const lines = points.slice(1).map((p,i) => [points[i],p]).concat([
  [[.27,.59],[.43,.56]], [[.73,.59],[.57,.56]], [[.43,.56],[.5,.72]], [[.57,.56],[.5,.72]],
]);
function distance(x,y,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}
await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
for (const size of [180,192,512]) {
  const raw=Buffer.alloc((size*3+1)*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const d=Math.min(...lines.map(([a,b])=>distance(x/size,y/size,a,b)));
    const alpha=Math.max(0,Math.min(1,(.013-d)*size+.5));
    const i=y*(size*3+1)+1+x*3;
    const background=[13,10,18], foreground=[174,105,236];
    for(let c=0;c<3;c++) raw[i+c]=Math.round(background[c]*(1-alpha)+foreground[c]*alpha);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
  await writeFile(new URL(`../public/icons/${size===180?'apple-touch-icon':`icon-${size}`}.png`,import.meta.url),png);
}
