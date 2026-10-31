// Contraste WCAG de la paleta "mono" (AA texto normal >= 4.5, texto grande/UI >= 3)
const lum = (h) => { const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const cr = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
const T = { bg:'#17100D', surface:'#2A1B14', surface2:'#3B261B', line:'#B88A62', red:'#E31E26', cream:'#FFF1E0', white:'#FFFFFF', gold:'#FF9E2C', tan:'#F3C79C', ink:'#0D0908', muted:'#D8C3B0', mint:'#8EE0A4', danger:'#FF9A92' };
const pairs = [
 ['cream','bg'],['cream','surface'],['cream','surface2'],['muted','bg'],['muted','surface'],['muted','surface2'],
 ['cream','red'],['white','red'],['ink','red'],['red','bg'],['red','surface'],
 ['ink','gold'],['gold','bg'],['gold','surface'],['ink','tan'],['tan','bg'],['mint','surface'],['ink','mint'],['danger','surface'],['ink','danger'],
 ['line','bg'],['line','surface'],['line','surface2'],['ink','cream']
];
for (const [f,b] of pairs) { const r=cr(T[f],T[b]); console.log(`${f.padEnd(8)} sobre ${b.padEnd(8)} ${r.toFixed(2)}  ${r>=7?'AAA':r>=4.5?'AA':r>=3?'solo grande/UI':'NO'}`); }
