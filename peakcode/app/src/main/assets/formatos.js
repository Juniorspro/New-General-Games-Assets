// formatos.js — todo lo que PeakCode puede escribir, generado offline.
//
// No hay librerías: ni JSZip, ni jsPDF, ni docx.js. Todo se arma a mano con
// Uint8Array porque la app tiene que andar al abrirla, sin descargar nada.
//
// La pieza que se reusa en casi todo es zip(): OOXML (docx, xlsx, pptx),
// OpenDocument (odt, ods) y EPUB son, los tres, un ZIP con XML adentro.

// Cada módulo va adentro de su propia función: son <script> clásicos y
// comparten el ámbito global, así que sin esto el `const G` de nucleo.js
// choca con el `const {G}` de los demás y no carga ninguno.
(function(){
'use strict';

// ── ladrillos ────────────────────────────────────────────────────────────────
function utf8(s){ return new TextEncoder().encode(s); }
function b64(u8){
  // de a pedazos: String.fromCharCode con 200k argumentos revienta la pila
  let s='', P=0x8000;
  for(let i=0;i<u8.length;i+=P) s+=String.fromCharCode.apply(null,u8.subarray(i,i+P));
  return btoa(s);
}
/**
 * Un carácter = un byte. El PDF lo necesita por dos motivos: los acentos van
 * en WinAnsi (que para á é í ó ú ñ ü coincide con Latin-1), y los offsets de
 * la tabla xref se cuentan en BYTES. Si se escribiera en UTF-8, cada acento
 * correría todos los offsets y el lector avisa "incorrect startxref pointer".
 */
function latin1(s){
  const u=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i)&0xFF;
  return u;
}

const _crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;
  for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u8){let c=0xFFFFFFFF;
  for(let i=0;i<u8.length;i++)c=_crcT[(c^u8[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;}

/**
 * ZIP store-only (sin comprimir). Entrada: [{nombre, texto}] o {nombre, datos}
 * donde datos es un Uint8Array, para poder meter binarios en un epub o un zip.
 *
 * Sin comprimir es exactamente lo que ODF y EPUB piden para su `mimetype`, que
 * además tiene que ir primero. Por eso el orden del arreglo se respeta.
 */
function zip(archivos){
  const le=[],ce=[]; let off=0;
  for(const a of archivos){
    const nom=utf8(a.nombre);
    const dat=a.datos!==undefined?a.datos:utf8(a.texto||'');
    const crc=crc32(dat);
    const lh=new Uint8Array(30+nom.length), dv=new DataView(lh.buffer);
    dv.setUint32(0,0x04034b50,true); dv.setUint16(4,20,true); dv.setUint16(6,0x800,true);
    dv.setUint32(14,crc,true); dv.setUint32(18,dat.length,true); dv.setUint32(22,dat.length,true);
    dv.setUint16(26,nom.length,true); lh.set(nom,30);
    le.push(lh,dat);
    const ch=new Uint8Array(46+nom.length), cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0x800,true); cv.setUint32(16,crc,true); cv.setUint32(20,dat.length,true);
    cv.setUint32(24,dat.length,true); cv.setUint16(28,nom.length,true);
    cv.setUint32(42,off,true); ch.set(nom,46);
    ce.push(ch);
    off+=lh.length+dat.length;
  }
  const cd=ce.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array(22), ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,ce.length,true); ev.setUint16(10,ce.length,true);
  ev.setUint32(12,cd,true); ev.setUint32(16,off,true);
  const partes=[...le,...ce,end], tot=partes.reduce((a,b)=>a+b.length,0);
  const out=new Uint8Array(tot); let p=0;
  for(const x of partes){ out.set(x,p); p+=x.length; }
  return out;
}

function xmlEsc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
const XMLCAB='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_REL='http://schemas.openxmlformats.org/package/2006/relationships';
const NS_OD ='http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function rels(lista){
  return XMLCAB+'<Relationships xmlns="'+NS_REL+'">'+lista.map(r=>
    '<Relationship Id="'+r.id+'" Type="'+r.tipo+'" Target="'+r.destino+'"/>').join('')+
    '</Relationships>';
}

// Parte una tabla de texto en filas/celdas. Entiende CSV (con comillas) y TSV.
function tabla(texto){
  const tsv=texto.includes('\t') && !texto.includes(',');
  if(tsv) return texto.replace(/\r/g,'').split('\n').filter(l=>l!=='').map(l=>l.split('\t'));
  const filas=[]; let fila=[], celda='', encomillado=false;
  for(let i=0;i<texto.length;i++){
    const c=texto[i];
    if(encomillado){
      if(c==='"'){ if(texto[i+1]==='"'){celda+='"';i++;} else encomillado=false; }
      else celda+=c;
    } else if(c==='"') encomillado=true;
    else if(c===','){ fila.push(celda); celda=''; }
    else if(c==='\n'){ fila.push(celda); filas.push(fila); fila=[]; celda=''; }
    else if(c!=='\r') celda+=c;
  }
  if(celda!==''||fila.length){ fila.push(celda); filas.push(fila); }
  return filas.filter(f=>f.length>1||f[0]!=='');
}

// Divide el texto en "diapositivas" o "secciones": corta por encabezado
// Markdown (#) y, si no hay ninguno, por línea en blanco doble.
function secciones(texto){
  const t=texto.trim();
  if(/^#{1,6}\s/m.test(t)){
    const trozos=t.split(/^(?=#{1,6}\s)/m).filter(x=>x.trim());
    return trozos.map(x=>{
      const l=x.split('\n');
      return { titulo:l[0].replace(/^#+\s*/,'').trim(),
               cuerpo:l.slice(1).join('\n').trim() };
    });
  }
  return t.split(/\n\s*\n/).filter(x=>x.trim()).map((x,i)=>{
    const l=x.split('\n');
    return { titulo:l[0].trim().slice(0,90), cuerpo:l.slice(1).join('\n').trim() };
  });
}

// ── PDF: A4, Helvetica, con corte de renglón y paginado ──────────────────────
function pdf(texto){
  const AN=595,AL=842,MX=50,MY=50,FS=11,LH=15,COLS=88;
  const lineas=[];
  for(const cruda of texto.split('\n')){
    if(cruda.length<=COLS){ lineas.push(cruda); continue; }
    let l=cruda;
    while(l.length>COLS){
      let corte=l.lastIndexOf(' ',COLS); if(corte<40)corte=COLS;
      lineas.push(l.slice(0,corte)); l=l.slice(corte).replace(/^ /,'');
    }
    lineas.push(l);
  }
  const porPag=Math.floor((AL-2*MY)/LH);
  const pags=[]; for(let i=0;i<lineas.length;i+=porPag)pags.push(lineas.slice(i,i+porPag));
  if(!pags.length)pags.push(['']);
  // Helvetica es WinAnsi: lo que no entra en un byte se translitera o se cae.
  const esc=t=>t.replace(/[^\x00-\xFF]/g,'?')
                .replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const obj=[];
  obj.push('<< /Type /Catalog /Pages 2 0 R >>');
  const kids=[]; pags.forEach((_,i)=>kids.push((3+i)+' 0 R'));
  obj.push('<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pags.length+' >>');
  const fuenteObj=3+pags.length;
  pags.forEach((_,i)=>{
    const cont=fuenteObj+1+i;
    obj.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+AN+' '+AL+'] '+
      '/Resources << /Font << /F1 '+fuenteObj+' 0 R >> >> /Contents '+cont+' 0 R >>');
  });
  obj.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pags.forEach(pag=>{
    let cs='BT /F1 '+FS+' Tf '+LH+' TL '+MX+' '+(AL-MY)+' Td\n';
    pag.forEach((l,j)=>{ cs+='('+esc(l)+') Tj'+(j<pag.length-1?' T*':'')+'\n'; });
    cs+='ET';
    obj.push('<< /Length '+cs.length+' >>\nstream\n'+cs+'\nendstream');
  });
  let doc='%PDF-1.4\n'; const offs=[0];
  obj.forEach((o,i)=>{ offs.push(doc.length); doc+=(i+1)+' 0 obj\n'+o+'\nendobj\n'; });
  const xref=doc.length;
  doc+='xref\n0 '+(obj.length+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<=obj.length;i++) doc+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  doc+='trailer\n<< /Size '+(obj.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return latin1(doc);
}

// ── Word ─────────────────────────────────────────────────────────────────────
function docx(texto){
  // los # de Markdown pasan a estilos de título, que es lo que uno espera
  const parr=texto.split('\n').map(l=>{
    const h=l.match(/^(#{1,6})\s+(.*)$/);
    const cuerpo=h?h[2]:l;
    const estilo=h?'<w:pPr><w:pStyle w:val="Heading'+h[1].length+'"/></w:pPr>':'';
    return '<w:p>'+estilo+'<w:r><w:t xml:space="preserve">'+xmlEsc(cuerpo)+'</w:t></w:r></w:p>';
  }).join('');
  const doc=XMLCAB+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
    '<w:body>'+parr+'</w:body></w:document>';
  const ct=XMLCAB+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
    '</Types>';
  return zip([
    {nombre:'[Content_Types].xml',texto:ct},
    {nombre:'_rels/.rels',texto:rels([{id:'rId1',tipo:NS_OD+'/officeDocument',destino:'word/document.xml'}])},
    {nombre:'word/document.xml',texto:doc}]);
}

// ── Excel ────────────────────────────────────────────────────────────────────
function col(n){ let s=''; n++; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-1-r)/26; } return s; }
function xlsx(texto){
  const filas=tabla(texto);
  const cuerpo=filas.map((f,i)=>'<row r="'+(i+1)+'">'+f.map((v,j)=>{
    const ref=col(j)+(i+1);
    // los números van como número; si no, Excel muestra el aviso verde
    if(v!=='' && /^-?\d+(\.\d+)?$/.test(v.trim()))
      return '<c r="'+ref+'"><v>'+v.trim()+'</v></c>';
    return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEsc(v)+'</t></is></c>';
  }).join('')+'</row>').join('');
  const NSS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const hoja=XMLCAB+'<worksheet xmlns="'+NSS+'"><sheetData>'+cuerpo+'</sheetData></worksheet>';
  const libro=XMLCAB+'<workbook xmlns="'+NSS+'" xmlns:r="'+NS_OD+'">'+
    '<sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const ct=XMLCAB+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'+
    '</Types>';
  return zip([
    {nombre:'[Content_Types].xml',texto:ct},
    {nombre:'_rels/.rels',texto:rels([{id:'rId1',tipo:NS_OD+'/officeDocument',destino:'xl/workbook.xml'}])},
    {nombre:'xl/workbook.xml',texto:libro},
    {nombre:'xl/_rels/workbook.xml.rels',texto:rels([{id:'rId1',tipo:NS_OD+'/worksheet',destino:'worksheets/sheet1.xml'}])},
    {nombre:'xl/worksheets/sheet1.xml',texto:hoja}]);
}

// ── PowerPoint ───────────────────────────────────────────────────────────────
// Un pptx mínimo igual necesita slideMaster, slideLayout y theme, si no
// PowerPoint lo da por dañado. Por eso hay tanto XML acá abajo.
const NS_P='http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A='http://schemas.openxmlformats.org/drawingml/2006/main';
function _temaPptx(){
  const fill='<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const linea='<a:ln w="9525" cap="flat"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>';
  return XMLCAB+'<a:theme xmlns:a="'+NS_A+'" name="PeakCode">'+
   '<a:themeElements><a:clrScheme name="PeakCode">'+
   '<a:dk1><a:srgbClr val="14100D"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>'+
   '<a:dk2><a:srgbClr val="14100D"/></a:dk2><a:lt2><a:srgbClr val="F3EFEA"/></a:lt2>'+
   '<a:accent1><a:srgbClr val="E0A264"/></a:accent1><a:accent2><a:srgbClr val="C97B3F"/></a:accent2>'+
   '<a:accent3><a:srgbClr val="8C6A4F"/></a:accent3><a:accent4><a:srgbClr val="5B4636"/></a:accent4>'+
   '<a:accent5><a:srgbClr val="A8927B"/></a:accent5><a:accent6><a:srgbClr val="6E5846"/></a:accent6>'+
   '<a:hlink><a:srgbClr val="C97B3F"/></a:hlink><a:folHlink><a:srgbClr val="8C6A4F"/></a:folHlink>'+
   '</a:clrScheme><a:fontScheme name="PeakCode">'+
   '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'+
   '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>'+
   '</a:fontScheme><a:fmtScheme name="PeakCode">'+
   '<a:fillStyleLst>'+fill+fill+fill+'</a:fillStyleLst>'+
   '<a:lnStyleLst>'+linea+linea+linea+'</a:lnStyleLst>'+
   '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle>'+
   '<a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'+
   '<a:bgFillStyleLst>'+fill+fill+fill+'</a:bgFillStyleLst>'+
   '</a:fmtScheme></a:themeElements></a:theme>';
}
function _formaTexto(id,nombre,x,y,an,al,parrafos,tam,negrita){
  return '<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="'+nombre+'"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'+
   '<p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+x+'" y="'+y+'"/><a:ext cx="'+an+'" cy="'+al+'"/></a:xfrm>'+
   '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'+
   '<p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>'+
   parrafos.map(t=>'<a:p><a:r><a:rPr lang="es" sz="'+tam+'"'+(negrita?' b="1"':'')+' dirty="0"/>'+
     '<a:t>'+xmlEsc(t)+'</a:t></a:r></a:p>').join('')+
   '</p:txBody></p:sp>';
}
function pptx(texto){
  const hojas=secciones(texto);
  if(!hojas.length) hojas.push({titulo:'PeakCode',cuerpo:''});
  const AN=12192000, AL=6858000;               // 16:9 en EMU
  const laminas=hojas.map(h=>{
    const vinetas=(h.cuerpo||'').split('\n').map(l=>l.replace(/^[-*+]\s*/,'').trim())
      .filter(Boolean).slice(0,12);
    return XMLCAB+'<p:sld xmlns:p="'+NS_P+'" xmlns:a="'+NS_A+'" xmlns:r="'+NS_OD+'">'+
      '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'+
      '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'+
      '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'+
      _formaTexto(2,'Titulo',838200,457200,AN-1676400,1325563,[h.titulo||' '],3200,true)+
      (vinetas.length?_formaTexto(3,'Cuerpo',838200,2000250,AN-1676400,AL-2600000,vinetas,1800,false):'')+
      '</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"'+
      ' accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5"'+
      ' accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>';
  });
  const mapaColor='<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1"'+
    ' accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6"'+
    ' hlink="hlink" folHlink="folHlink"/>';
  const arbolVacio='<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'+
    '</p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>'+
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>';
  const maestra=XMLCAB+'<p:sldMaster xmlns:p="'+NS_P+'" xmlns:a="'+NS_A+'" xmlns:r="'+NS_OD+'">'+
    arbolVacio+mapaColor+'<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'+
    '</p:sldMaster>';
  const diseno=XMLCAB+'<p:sldLayout xmlns:p="'+NS_P+'" xmlns:a="'+NS_A+'" xmlns:r="'+NS_OD+'"'+
    ' type="blank" preserve="1">'+arbolVacio+'<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
  const pres=XMLCAB+'<p:presentation xmlns:p="'+NS_P+'" xmlns:a="'+NS_A+'" xmlns:r="'+NS_OD+'">'+
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'+
    '<p:sldIdLst>'+laminas.map((_,i)=>'<p:sldId id="'+(256+i)+'" r:id="rId'+(i+2)+'"/>').join('')+'</p:sldIdLst>'+
    '<p:sldSz cx="'+AN+'" cy="'+AL+'"/><p:notesSz cx="'+AL+'" cy="'+AN+'"/></p:presentation>';
  const presRels=rels([{id:'rId1',tipo:NS_OD+'/slideMaster',destino:'slideMasters/slideMaster1.xml'}]
    .concat(laminas.map((_,i)=>({id:'rId'+(i+2),tipo:NS_OD+'/slide',destino:'slides/slide'+(i+1)+'.xml'}))));
  const ct=XMLCAB+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
    '<Default Extension="xml" ContentType="application/xml"/>'+
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'+
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'+
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'+
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'+
    laminas.map((_,i)=>'<Override PartName="/ppt/slides/slide'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('')+
    '</Types>';
  const partes=[
    {nombre:'[Content_Types].xml',texto:ct},
    {nombre:'_rels/.rels',texto:rels([{id:'rId1',tipo:NS_OD+'/officeDocument',destino:'ppt/presentation.xml'}])},
    {nombre:'ppt/presentation.xml',texto:pres},
    {nombre:'ppt/_rels/presentation.xml.rels',texto:presRels},
    {nombre:'ppt/slideMasters/slideMaster1.xml',texto:maestra},
    {nombre:'ppt/slideMasters/_rels/slideMaster1.xml.rels',texto:rels([
      {id:'rId1',tipo:NS_OD+'/slideLayout',destino:'../slideLayouts/slideLayout1.xml'},
      {id:'rId2',tipo:NS_OD+'/theme',destino:'../theme/theme1.xml'}])},
    {nombre:'ppt/slideLayouts/slideLayout1.xml',texto:diseno},
    {nombre:'ppt/slideLayouts/_rels/slideLayout1.xml.rels',texto:rels([
      {id:'rId1',tipo:NS_OD+'/slideMaster',destino:'../slideMasters/slideMaster1.xml'}])},
    {nombre:'ppt/theme/theme1.xml',texto:_temaPptx()}];
  laminas.forEach((l,i)=>{
    partes.push({nombre:'ppt/slides/slide'+(i+1)+'.xml',texto:l});
    partes.push({nombre:'ppt/slides/_rels/slide'+(i+1)+'.xml.rels',texto:rels([
      {id:'rId1',tipo:NS_OD+'/slideLayout',destino:'../slideLayouts/slideLayout1.xml'}])});
  });
  return zip(partes);
}

// ── OpenDocument (LibreOffice): odt y ods ────────────────────────────────────
// El `mimetype` va primero y sin comprimir. Nuestro zip no comprime nunca, así
// que alcanza con ponerlo primero en el arreglo.
const NS_ODF={
  office:'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  text:'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table:'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  manifest:'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0'
};
function _manifiestoOdf(tipo){
  return XMLCAB+'<manifest:manifest xmlns:manifest="'+NS_ODF.manifest+'" manifest:version="1.2">'+
    '<manifest:file-entry manifest:full-path="/" manifest:media-type="'+tipo+'"/>'+
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'+
    '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'+
    '</manifest:manifest>';
}
function _estilosOdf(){
  return XMLCAB+'<office:document-styles xmlns:office="'+NS_ODF.office+'" office:version="1.2">'+
    '<office:styles/></office:document-styles>';
}
function odt(texto){
  const TIPO='application/vnd.oasis.opendocument.text';
  const parr=texto.split('\n').map(l=>{
    const h=l.match(/^(#{1,6})\s+(.*)$/);
    return h ? '<text:h text:outline-level="'+h[1].length+'">'+xmlEsc(h[2])+'</text:h>'
             : '<text:p>'+xmlEsc(l)+'</text:p>';
  }).join('');
  const cont=XMLCAB+'<office:document-content xmlns:office="'+NS_ODF.office+'" xmlns:text="'+NS_ODF.text+
    '" office:version="1.2"><office:body><office:text>'+parr+'</office:text></office:body></office:document-content>';
  return zip([
    {nombre:'mimetype',texto:TIPO},
    {nombre:'META-INF/manifest.xml',texto:_manifiestoOdf(TIPO)},
    {nombre:'styles.xml',texto:_estilosOdf()},
    {nombre:'content.xml',texto:cont}]);
}
function ods(texto){
  const TIPO='application/vnd.oasis.opendocument.spreadsheet';
  const filas=tabla(texto).map(f=>'<table:table-row>'+f.map(v=>{
    const num=v!=='' && /^-?\d+(\.\d+)?$/.test(v.trim());
    return '<table:table-cell office:value-type="'+(num?'float" office:value="'+v.trim():'string')+'">'+
      '<text:p>'+xmlEsc(v)+'</text:p></table:table-cell>';
  }).join('')+'</table:table-row>').join('');
  const cont=XMLCAB+'<office:document-content xmlns:office="'+NS_ODF.office+'" xmlns:text="'+NS_ODF.text+
    '" xmlns:table="'+NS_ODF.table+'" office:version="1.2"><office:body><office:spreadsheet>'+
    '<table:table table:name="Hoja1">'+filas+'</table:table></office:spreadsheet></office:body></office:document-content>';
  return zip([
    {nombre:'mimetype',texto:TIPO},
    {nombre:'META-INF/manifest.xml',texto:_manifiestoOdf(TIPO)},
    {nombre:'styles.xml',texto:_estilosOdf()},
    {nombre:'content.xml',texto:cont}]);
}

// ── EPUB 3 ───────────────────────────────────────────────────────────────────
function epub(texto, titulo){
  const tit=titulo||'PeakCode';
  const caps=secciones(texto);
  if(!caps.length) caps.push({titulo:tit,cuerpo:texto});
  const id='urn:uuid:peakcode-'+Date.now();
  const paginas=caps.map((c,i)=>
    '<?xml version="1.0" encoding="UTF-8"?>'+
    '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="es"><head><meta charset="utf-8"/>'+
    '<title>'+xmlEsc(c.titulo)+'</title></head><body><h1>'+xmlEsc(c.titulo)+'</h1>'+
    (c.cuerpo||'').split('\n').filter(l=>l.trim()).map(l=>'<p>'+xmlEsc(l)+'</p>').join('')+
    '</body></html>');
  const opf='<?xml version="1.0" encoding="UTF-8"?>'+
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pid">'+
    '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'+
    '<dc:identifier id="pid">'+id+'</dc:identifier><dc:title>'+xmlEsc(tit)+'</dc:title>'+
    '<dc:language>es</dc:language>'+
    '<meta property="dcterms:modified">'+new Date().toISOString().replace(/\.\d+Z$/,'Z')+'</meta>'+
    '</metadata><manifest>'+
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'+
    paginas.map((_,i)=>'<item id="c'+i+'" href="c'+i+'.xhtml" media-type="application/xhtml+xml"/>').join('')+
    '</manifest><spine>'+paginas.map((_,i)=>'<itemref idref="c'+i+'"/>').join('')+'</spine></package>';
  const nav='<?xml version="1.0" encoding="UTF-8"?>'+
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es">'+
    '<head><meta charset="utf-8"/><title>Índice</title></head><body><nav epub:type="toc"><ol>'+
    caps.map((c,i)=>'<li><a href="c'+i+'.xhtml">'+xmlEsc(c.titulo)+'</a></li>').join('')+
    '</ol></nav></body></html>';
  const partes=[
    {nombre:'mimetype',texto:'application/epub+zip'},
    {nombre:'META-INF/container.xml',texto:'<?xml version="1.0" encoding="UTF-8"?>'+
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'+
      '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'+
      '</rootfiles></container>'},
    {nombre:'OEBPS/content.opf',texto:opf},
    {nombre:'OEBPS/nav.xhtml',texto:nav}];
  paginas.forEach((p,i)=>partes.push({nombre:'OEBPS/c'+i+'.xhtml',texto:p}));
  return zip(partes);
}

// ── RTF ──────────────────────────────────────────────────────────────────────
function rtf(texto){
  // RTF es ASCII: todo lo de arriba de 127 va como \uN? con el código UTF-16
  let s='';
  for(const c of texto){
    const p=c.codePointAt(0);
    if(c==='\\'||c==='{'||c==='}') s+='\\'+c;
    else if(c==='\n') s+='\\par\n';
    else if(p>127) s+='\\u'+(p>65535?'?':(p>32767?p-65536:p))+'?';
    else if(c!=='\r') s+=c;
  }
  return utf8('{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\fs22 '+s+'}');
}

// ── envoltorios de texto ─────────────────────────────────────────────────────
function htmlSuelto(texto){
  if(/<html|<!doctype/i.test(texto)) return texto;
  return '<!doctype html>\n<meta charset=utf-8>\n<title>PeakCode</title>\n'+
    '<body style="font:16px/1.6 system-ui;max-width:42em;margin:2em auto;padding:0 1em;white-space:pre-wrap">'+
    texto.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</body>';
}

// ── el catálogo ──────────────────────────────────────────────────────────────
// bin:true => se genera en bytes y va por guardarBinario.
// bin:false => es texto y se guarda tal cual (o pasando por `arma`).
const FORMATOS=[
  // documentos
  {ext:'txt', nom:'Texto', grupo:'Documento', mime:'text/plain'},
  {ext:'md',  nom:'Markdown', grupo:'Documento', mime:'text/markdown'},
  {ext:'pdf', nom:'PDF', grupo:'Documento', mime:'application/pdf', bin:true, arma:pdf},
  {ext:'docx',nom:'Word', grupo:'Documento', mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bin:true, arma:docx},
  {ext:'odt', nom:'LibreOffice Writer', grupo:'Documento', mime:'application/vnd.oasis.opendocument.text', bin:true, arma:odt},
  {ext:'rtf', nom:'RTF', grupo:'Documento', mime:'application/rtf', bin:true, arma:rtf},
  {ext:'epub',nom:'Libro EPUB', grupo:'Documento', mime:'application/epub+zip', bin:true, arma:epub},
  {ext:'tex', nom:'LaTeX', grupo:'Documento', mime:'application/x-tex'},
  // planillas
  {ext:'csv', nom:'CSV', grupo:'Planilla', mime:'text/csv'},
  {ext:'tsv', nom:'TSV', grupo:'Planilla', mime:'text/tab-separated-values'},
  {ext:'xlsx',nom:'Excel', grupo:'Planilla', mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bin:true, arma:xlsx},
  {ext:'ods', nom:'LibreOffice Calc', grupo:'Planilla', mime:'application/vnd.oasis.opendocument.spreadsheet', bin:true, arma:ods},
  // presentación
  {ext:'pptx',nom:'PowerPoint', grupo:'Presentación', mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation', bin:true, arma:pptx},
  // web
  {ext:'html',nom:'Página web', grupo:'Web', mime:'text/html', arma:htmlSuelto},
  {ext:'css', nom:'Hoja de estilo', grupo:'Web', mime:'text/css'},
  {ext:'js',  nom:'JavaScript', grupo:'Web', mime:'text/javascript'},
  {ext:'ts',  nom:'TypeScript', grupo:'Web', mime:'text/plain'},
  {ext:'jsx', nom:'React JSX', grupo:'Web', mime:'text/plain'},
  {ext:'tsx', nom:'React TSX', grupo:'Web', mime:'text/plain'},
  {ext:'vue', nom:'Vue', grupo:'Web', mime:'text/plain'},
  {ext:'svg', nom:'Dibujo SVG', grupo:'Web', mime:'image/svg+xml'},
  // datos
  {ext:'json',nom:'JSON', grupo:'Datos', mime:'application/json'},
  {ext:'jsonl',nom:'JSON por líneas', grupo:'Datos', mime:'application/jsonl'},
  {ext:'xml', nom:'XML', grupo:'Datos', mime:'application/xml'},
  {ext:'yaml',nom:'YAML', grupo:'Datos', mime:'application/yaml'},
  {ext:'toml',nom:'TOML', grupo:'Datos', mime:'application/toml'},
  {ext:'ini', nom:'INI', grupo:'Datos', mime:'text/plain'},
  {ext:'sql', nom:'SQL', grupo:'Datos', mime:'application/sql'},
  {ext:'geojson',nom:'GeoJSON', grupo:'Datos', mime:'application/geo+json'},
  // código
  {ext:'py',  nom:'Python', grupo:'Código', mime:'text/x-python'},
  {ext:'java',nom:'Java', grupo:'Código', mime:'text/x-java'},
  {ext:'kt',  nom:'Kotlin', grupo:'Código', mime:'text/plain'},
  {ext:'swift',nom:'Swift', grupo:'Código', mime:'text/plain'},
  {ext:'c',   nom:'C', grupo:'Código', mime:'text/x-c'},
  {ext:'h',   nom:'Cabecera C', grupo:'Código', mime:'text/x-c'},
  {ext:'cpp', nom:'C++', grupo:'Código', mime:'text/x-c++'},
  {ext:'cs',  nom:'C#', grupo:'Código', mime:'text/plain'},
  {ext:'go',  nom:'Go', grupo:'Código', mime:'text/x-go'},
  {ext:'rs',  nom:'Rust', grupo:'Código', mime:'text/rust'},
  {ext:'rb',  nom:'Ruby', grupo:'Código', mime:'text/x-ruby'},
  {ext:'php', nom:'PHP', grupo:'Código', mime:'application/x-httpd-php'},
  {ext:'lua', nom:'Lua', grupo:'Código', mime:'text/x-lua'},
  {ext:'r',   nom:'R', grupo:'Código', mime:'text/plain'},
  {ext:'dart',nom:'Dart', grupo:'Código', mime:'text/plain'},
  {ext:'sh',  nom:'Shell', grupo:'Código', mime:'application/x-sh'},
  {ext:'bat', nom:'Batch', grupo:'Código', mime:'text/plain'},
  {ext:'ps1', nom:'PowerShell', grupo:'Código', mime:'text/plain'},
  {ext:'diff',nom:'Parche diff', grupo:'Código', mime:'text/x-diff'},
  // varios
  {ext:'srt', nom:'Subtítulos SRT', grupo:'Varios', mime:'application/x-subrip'},
  {ext:'vtt', nom:'Subtítulos WebVTT', grupo:'Varios', mime:'text/vtt'},
  {ext:'ics', nom:'Calendario', grupo:'Varios', mime:'text/calendar'},
  {ext:'vcf', nom:'Contacto', grupo:'Varios', mime:'text/vcard'},
  {ext:'m3u', nom:'Lista de temas', grupo:'Varios', mime:'audio/x-mpegurl'},
  {ext:'gpx', nom:'Recorrido GPS', grupo:'Varios', mime:'application/gpx+xml'},
  {ext:'log', nom:'Registro', grupo:'Varios', mime:'text/plain'},
  {ext:'env', nom:'Variables de entorno', grupo:'Varios', mime:'text/plain'},
  {ext:'zip', nom:'ZIP con todo el taller', grupo:'Varios', mime:'application/zip', bin:true, taller:true},
];
const POREXT={}; FORMATOS.forEach(f=>POREXT[f.ext]=f);

// alias que la gente y los modelos escriben distinto
const ALIAS={markdown:'md',htm:'html',yml:'yaml',javascript:'js',typescript:'ts',
  python:'py',bash:'sh',zsh:'sh',shell:'sh','c++':'cpp',cxx:'cpp',golang:'go',
  rust:'rs',ruby:'rb',text:'txt',plaintext:'txt',word:'docx',excel:'xlsx',
  powerpoint:'pptx',latex:'tex',dockerfile:'txt',makefile:'txt'};
function normExt(e){ e=String(e||'').toLowerCase().replace(/^\./,''); return ALIAS[e]||e; }

/** Devuelve {bytes|texto, mime} listo para el puente. */
function construir(ext, texto, nombre){
  ext=normExt(ext);
  const f=POREXT[ext];
  if(!f) return {texto:texto, mime:'text/plain'};        // extensión que no conocemos: texto pelado
  if(f.bin) return {bytes:f.arma(texto, nombre), mime:f.mime};
  return {texto:f.arma?f.arma(texto):texto, mime:f.mime};
}

window.PeakFormatos={utf8,latin1,b64,zip,crc32,pdf,docx,xlsx,pptx,odt,ods,epub,rtf,
  htmlSuelto,tabla,secciones,FORMATOS,POREXT,normExt,construir,xmlEsc};

})();
