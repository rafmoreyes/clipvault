'use strict';
// All app icon pixels are generated locally; no images are tracked in Git.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const W = 512;
const pixels = new Uint8Array(W * W * 4);
const C = {
  navy: '#081728', edge: '#0a2031', frame: '#223c5a', rim: '#456895',
  gold: '#ffc32d', goldLight: '#ffe070', goldDark: '#c47a08',
  aqua: '#36dcc6', aquaLight: '#81f1db', teal: '#079c99', tealDark: '#075c65',
  shadow: '#102a42', blue: '#264969', white: '#ffffff'
};
function rgb(hex) { return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255]; }
function rect(x,y,w,h,col,r=0) {
  const rgba=rgb(col);const rr=r*r;
  for(let iy=Math.max(0,Math.floor(y*2));iy<Math.min(W,Math.ceil((y+h)*2));iy++){
    for(let ix=Math.max(0,Math.floor(x*2));ix<Math.min(W,Math.ceil((x+w)*2));ix++){
      const xx=ix/2, yy=iy/2;
      let cx=Math.max(x+r,Math.min(x+w-r,xx)),cy=Math.max(y+r,Math.min(y+h-r,yy));
      if ((xx-cx)*(xx-cx)+(yy-cy)*(yy-cy)>rr)continue;
      const k=(iy*W+ix)*4;pixels.set(rgba,k);
    }
  }
}
function circle(cx,cy,r,col){const rgba=rgb(col);for(let iy=Math.max(0,Math.floor((cy-r)*2));iy<Math.min(W,Math.ceil((cy+r)*2));iy++){for(let ix=Math.max(0,Math.floor((cx-r)*2));ix<Math.min(W,Math.ceil((cx+r)*2));ix++){let dx=ix/2-cx,dy=iy/2-cy;if(dx*dx+dy*dy<=r*r)pixels.set(rgba,(iy*W+ix)*4);}}}
function polygon(points,col){const rgba=rgb(col);const ys=points.map(p=>p[1]);for(let iy=Math.max(0,Math.floor(Math.min(...ys)*2));iy<Math.min(W,Math.ceil(Math.max(...ys)*2));iy++){const y=iy/2;const hits=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y))hits.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}hits.sort((a,b)=>a-b);for(let k=0;k+1<hits.length;k+=2){for(let ix=Math.max(0,Math.ceil(hits[k]*2));ix<Math.min(W,Math.floor(hits[k+1]*2));ix++)pixels.set(rgba,(iy*W+ix)*4);}}}
function thickLine(x1,y1,x2,y2,width,col){const rgba=rgb(col);const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;const r=width/2;const xMin=Math.max(0,Math.floor((Math.min(x1,x2)-r)*2)),xMax=Math.min(W,Math.ceil((Math.max(x1,x2)+r)*2));const yMin=Math.max(0,Math.floor((Math.min(y1,y2)-r)*2)),yMax=Math.min(W,Math.ceil((Math.max(y1,y2)+r)*2));for(let iy=yMin;iy<yMax;iy++)for(let ix=xMin;ix<xMax;ix++){const x=ix/2,y=iy/2,t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/len2)),d2=(x-(x1+t*dx))**2+(y-(y1+t*dy))**2;if(d2<=r*r)pixels.set(rgba,(iy*W+ix)*4);}}
// Frame, landscape, and unmistakable safe-dial centerpiece.
rect(12,12,232,232,C.navy,37);
rect(17,17,222,222,C.frame,32);
rect(24,24,208,208,C.shadow,29);
rect(27,27,202,202,C.blue,26);
rect(38,40,183,179,C.navy,20);
rect(43,43,173,173,C.gold,18);
rect(49,49,161,161,C.goldLight,14);
rect(54,54,151,151,C.navy,12);
rect(58,58,143,143,C.aqua,9);
polygon([[58,137],[93,98],[129,128],[156,110],[201,145],[201,201],[58,201]],C.tealDark);
polygon([[58,157],[86,135],[121,158],[157,122],[201,163],[201,201],[58,201]],C.teal);
polygon([[58,184],[99,164],[147,190],[180,175],[201,190],[201,201],[58,201]],C.aquaLight);
circle(173,89,17,C.goldLight);
polygon([[58,66],[89,58],[58,89]],'#8bf7e8');
rect(206,75,26,34,C.navy,8);rect(209,79,20,26,C.gold,7);rect(212,80,13,18,C.goldLight,6);
rect(206,155,26,34,C.navy,8);rect(209,159,20,26,C.gold,7);rect(212,160,13,18,C.goldLight,6);
circle(128,138,53,C.navy);circle(128,138,48,C.frame);circle(128,138,42,C.goldDark);circle(128,138,36,C.gold);circle(128,138,30,C.navy);
for(const angle of [-Math.PI/2,Math.PI/6,5*Math.PI/6]){
  const x2=128+53*Math.cos(angle),y2=138+53*Math.sin(angle);
  thickLine(128,138,x2,y2,20,C.navy);thickLine(128,138,x2,y2,12,C.gold);thickLine(128,138,x2,y2,5,C.goldLight);
}
circle(128,138,22,C.navy);circle(128,138,17,C.goldDark);circle(127,136,14,C.gold);circle(123,132,7,C.goldLight);
// Downsample 2x for smoother icon and write a deterministic PNG+ICO.
const size=256, rgba=Buffer.alloc(size*size*4);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const vals=[0,0,0,0];
  for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){
    const n=((2*y+yy)*W+2*x+xx)*4;
    for(let c=0;c<4;c++)vals[c]+=pixels[n+c];
  }
  for(let c=0;c<4;c++)rgba[(y*size+x)*4+c]=Math.round(vals[c]/4);
}
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(buf){let n=0xffffffff;for(const b of buf)n=crcTable[(n^b)&0xff]^(n>>>8);return (n^0xffffffff)>>>0;}
function chunk(tag,data){const kind=Buffer.from(tag,'ascii'),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([kind,data])));return Buffer.concat([len,kind,data,crc]);}
function makePng(width,height,bytes){const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;const line=width*4+1,scan=Buffer.alloc(line*height);for(let y=0;y<height;y++)bytes.copy(scan,y*line+1,y*width*4,(y+1)*width*4);return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
const png=makePng(size,size,rgba);const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=0;header[7]=0;header[8]=0;header[9]=0;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
const out=path.resolve(__dirname,'..','build');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'icon.png'),png);fs.writeFileSync(path.join(out,'icon.ico'),Buffer.concat([header,png]));
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
console.log('ClipVault: ícone do cofre gerado em build/icon.png e build/icon.ico (somente local).');
