// Contraste WCAG entre pares de colores de la paleta (AA texto normal >= 4.5, texto grande/UI >= 3)
const lum = (h) => { const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const cr = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const T = { bg:'#191329', surface:'#2B2040', surface2:'#3A2C55', coral:'#FF6B6B', cream:'#FFF4E6', yellow:'#FFD166', muted:'#CDBFE6', mint:'#7EE0B5', ink:'#191329', line:'#6B5A94' };
const pairs = [
 ['cream','bg'],['cream','surface'],['cream','surface2'],['muted','bg'],['muted','surface'],['muted','surface2'],
 ['ink','coral'],['cream','coral'],['coral','bg'],['coral','surface'],
 ['ink','yellow'],['yellow','bg'],['yellow','surface'],['mint','surface'],['ink','mint'],['line','bg'],['line','surface']
];
for (const [f,b] of pairs) { const r=cr(T[f],T[b]); console.log(`${f.padEnd(8)} sobre ${b.padEnd(8)} ${r.toFixed(2)}  ${r>=7?'AAA':r>=4.5?'AA':r>=3?'solo grande/UI':'NO'}`); }
