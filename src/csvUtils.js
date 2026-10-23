/** Parse CSV/TSV text without breaking quoted commas, escaped quotes, or newlines. */
export function parseDelimitedRows(input, delimiter = ',') {
  if (typeof input !== 'string') throw new TypeError('Import content must be text.');
  if (typeof delimiter !== 'string' || delimiter.length !== 1) throw new TypeError('Delimiter must be one character.');
  const text = input.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let atCellStart = true;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (char === delimiter) {
      row.push(cell.trim());
      cell = '';
      atCellStart = true;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
      atCellStart = true;
    } else {
      cell += char;
      if (!/\s/.test(char)) atCellStart = false;
    }
  }
  if (quoted) throw new Error('The import file has an unclosed quoted field. Check the CSV and try again.');
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

export function parseDelimitedObjects(input, delimiter = ',') {
  const rows = parseDelimitedRows(input, delimiter);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

/** Protect text cells from spreadsheet formula execution on export. */
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^\s*[=+@]/.test(text) || /^\s*-\s*[A-Za-z]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
