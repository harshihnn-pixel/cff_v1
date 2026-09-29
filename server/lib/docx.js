// Minimal Word (.docx) writer — no extra packages. Produces headings, paragraphs, bullet lists and tables.
const zlib = require("zlib");

const CRC = (() => { const t = new Uint32Array(256); for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf){ let c = 0xFFFFFFFF; for(let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

function zip(files){ // files: [{ name, data: Buffer }]
  const parts = [], central = []; let offset = 0;
  files.forEach(f => {
    const name = Buffer.from(f.name, "utf8"), raw = f.data, comp = zlib.deflateRawSync(raw), crc = crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, comp);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(raw.length, 24); cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(0, 30); cen.writeUInt32LE(0, 34); cen.writeUInt32LE(0, 38); cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + comp.length;
  });
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

const x = s => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (t, o = {}) => String(t == null ? "" : t).split("\n").map((line, i) =>
  (i ? "<w:r><w:br/></w:r>" : "") + `<w:r>${o.b || o.i || o.color ? `<w:rPr>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}</w:rPr>` : ""}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`).join("");
const para = (t, style, o) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${run(t, o)}</w:p>`;
const cell = (t, head, w) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF2"/>' : ""}</w:tcPr><w:p>${run(t, { b: head })}</w:p></w:tc>`;
const TBL_PR = '<w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>' + ["top","left","bottom","right","insideH","insideV"].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="C9D1D9"/>`).join("") +
  '</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>';
function table(head, rows, widths){
  const cols = head.length, w = widths || Array(cols).fill(Math.floor(9000 / cols));
  return `<w:tbl>${TBL_PR}<w:tblGrid>${w.map(v => `<w:gridCol w:w="${v}"/>`).join("")}</w:tblGrid>` +
    `<w:tr><w:trPr><w:tblHeader/></w:trPr>${head.map((h, i) => cell(h, true, w[i])).join("")}</w:tr>` +
    rows.map(r => `<w:tr>${r.map((c, i) => cell(c, false, w[i])).join("")}</w:tr>`).join("") + "</w:tbl>" + para("");
}
// Two columns: label | value
function kvTable(rows){
  return `<w:tbl>${TBL_PR}<w:tblGrid><w:gridCol w:w="2600"/><w:gridCol w:w="6400"/></w:tblGrid>` +
    rows.map(r => `<w:tr>${cell(r[0], true, 2600)}${cell(r[1], false, 6400)}</w:tr>`).join("") + "</w:tbl>" + para("");
}

// blocks: [{ type: 'title'|'h1'|'h2'|'p'|'note'|'list'|'kv'|'table', ... }]
function build(blocks){
  const body = blocks.map(b => {
    switch(b.type){
      case "title": return para(b.text, "Title");
      case "h1": return para(b.text, "Heading1");
      case "h2": return para(b.text, "Heading2");
      case "note": return para(b.text, null, { i: true, color: "667380" });
      case "list": return (b.items || []).map(t => para("•  " + t)).join("");
      case "kv": return (b.title ? para(b.title, "Heading2") : "") + (b.rows && b.rows.length ? kvTable(b.rows) : "");
      case "table": return table(b.head, b.rows || []);
      default: return para(b.text || "");
    }
  }).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/><w:color w:val="0F766E"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="14202A"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="25"/><w:color w:val="0F766E"/></w:rPr></w:style>
</w:styles>`;
  const files = [
    { name: "[Content_Types].xml", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`) },
    { name: "_rels/.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: "word/_rels/document.xml.rels", data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) },
    { name: "word/document.xml", data: Buffer.from(doc) },
    { name: "word/styles.xml", data: Buffer.from(styles) }
  ];
  return zip(files);
}

module.exports = { build, zip, crc32 };
