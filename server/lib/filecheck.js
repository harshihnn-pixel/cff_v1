// Checks an uploaded file's real content, not only the type the browser claims.
// Returns "" when the file is acceptable, otherwise a message for the person.
const EXT = {
  "application/pdf": ["pdf"], "image/png": ["png"], "image/jpeg": ["jpg", "jpeg"], "image/webp": ["webp"], "image/gif": ["gif"], "image/svg+xml": ["svg"],
  "text/plain": ["txt"], "text/csv": ["csv"], "application/msword": ["doc"], "application/vnd.ms-excel": ["xls"], "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"]
};
const starts = (b, bytes, at = 0) => bytes.every((x, i) => b[at + i] === x);
const isText = b => { const n = Math.min(b.length, 8192); for(let i = 0; i < n; i++){ const c = b[i]; if(c === 0 || (c < 9) || (c > 13 && c < 32 && c !== 27)) return false; } return true; };

function checkFile(buf, mime, name){
  if(!EXT[mime]) return "This file type isn't allowed. Upload a PDF, image, Word, Excel, PowerPoint, text or CSV file.";
  const ext = (String(name || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/) || [])[1];
  if(ext && !EXT[mime].includes(ext)) return "The file name ends in ." + ext + " but the file is not that type. Check the file and try again.";
  let ok;
  switch(mime){
    case "application/pdf": ok = starts(buf, [0x25, 0x50, 0x44, 0x46]); break;                                   // %PDF
    case "image/png": ok = starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); break;
    case "image/jpeg": ok = starts(buf, [0xff, 0xd8, 0xff]); break;
    case "image/gif": ok = starts(buf, [0x47, 0x49, 0x46, 0x38]); break;                                          // GIF8
    case "image/webp": ok = starts(buf, [0x52, 0x49, 0x46, 0x46]) && starts(buf, [0x57, 0x45, 0x42, 0x50], 8); break;  // RIFF....WEBP
    case "application/msword": case "application/vnd.ms-excel": case "application/vnd.ms-powerpoint":
      ok = starts(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); break;                                  // Office 97-2003
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      ok = starts(buf, [0x50, 0x4b, 0x03, 0x04]); break;                                                         // ZIP (PK)
    case "text/plain": case "text/csv": ok = isText(buf); break;
    case "image/svg+xml": {
      const t = buf.toString("utf8");
      if(!isText(buf) || !/<svg[\s>]/i.test(t)) { ok = false; break; }
      // Logos only: SVG files with scripts, event handlers, external content or embedded HTML are refused.
      if(/<script|\son[a-z]+\s*=|javascript:|<foreignObject|<iframe|<embed|<object|xlink:href\s*=\s*["']?(?!#)|href\s*=\s*["']?(https?:|data:text)/i.test(t))
        return "This SVG contains scripts or links, which aren't allowed. Export a plain SVG or upload a PNG instead.";
      ok = true; break;
    }
    default: ok = false;
  }
  return ok ? "" : "The file's content doesn't match its type (" + EXT[mime][0].toUpperCase() + "). It may be damaged or renamed. Please upload the original file.";
}

module.exports = { checkFile, EXT };
