/*!
 * Net Flow Map unpack: opens .zip and .xlsx files safely and hands back plain text files for the importers.
 * Copyright (c) 2026 LFC Foundry. MIT License. No DOM; runs in the page (DecompressionStream) or in Node (zlib).
 *
 * Safety: the zip's own table of contents is read once and checked; nothing is trusted that the bytes can't back up.
 * Every limit below is counted on what is really unpacked, not on what the file claims, so a zip bomb stops at the limit.
 */
var NFMUnpack = (function () {
  'use strict';
  var IMP = typeof NFMImport !== 'undefined' ? NFMImport : require('./importers.js');
  var LIMITS = {
    maxEntries: 20000,          // files listed inside one zip
    maxFiles: 5000,             // text files handed to the importers
    maxEntryBytes: 60000000,    // one text file
    maxPartBytes: 150000000,    // one spreadsheet sheet (XML is wordy)
    maxTotalBytes: 400000000,   // everything unpacked from one drop, all zips together
    maxDepth: 3                 // zips inside zips
  };
  var TEXT_EXT = /\.(md|markdown|txt|text|csv|tsv|tab|psv|dsv|prn|json|jsonl|ndjson|canvas|dot|gv|gml|graphml|gexf|xml)$/i;
  var JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|\.git|\.obsidian|node_modules)(\/|$)|(^|\/)\._/i;

  function u16(d, o) { return d.getUint16(o, true); }
  function u32(d, o) { return d.getUint32(o, true); }
  function u64(d, o) { var lo = d.getUint32(o, true), hi = d.getUint32(o + 4, true); return hi > 0x1fffff ? Infinity : lo + hi * 4294967296; }

  var CRC_T = null;
  function crc32(u8) {
    if (!CRC_T) { CRC_T = new Int32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; CRC_T[n] = c; } }
    var crc = -1, t = CRC_T;
    for (var i = 0, L = u8.length; i < L; i++) crc = (crc >>> 8) ^ t[(crc ^ u8[i]) & 255];
    return (crc ^ -1) >>> 0;
  }
  function isZip(u8) { return u8 && u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b && (u8[2] === 3 || u8[2] === 5) && (u8[3] === 4 || u8[3] === 6); }

  function cleanPath(p) {
    var out = [];
    String(p).replace(/\\/g, '/').split('/').forEach(function (s) { s = s.replace(/[\u0000-\u001f]/g, '').trim(); if (s && s !== '.' && s !== '..') out.push(s); });
    return out.join('/').slice(0, 300);
  }
  function decodeName(u8, utf8) {
    if (utf8) { try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { /* fall through */ } }
    var ok = true; for (var i = 0; i < u8.length; i++) if (u8[i] > 127) { ok = false; break; }
    if (ok) return String.fromCharCode.apply(null, u8);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { return new TextDecoder('windows-1252').decode(u8); }
  }

  /** Reads the table of contents. Returns { entries: [{ path, method, flags, crc, csize, usize, start, dir }], notes: [] }. Throws a plain-words Error when it isn't a zip. */
  function list(u8, lim) {
    lim = lim || LIMITS;
    var bad = function () { return new Error('This is not a zip file I can read (it may be cut off or damaged).'); };
    if (!u8 || u8.length < 22) throw bad();
    var d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), eocd = -1, lo = Math.max(0, u8.length - 22 - 65535);
    for (var p = u8.length - 22; p >= lo; p--) if (u8[p] === 0x50 && u8[p + 1] === 0x4b && u8[p + 2] === 5 && u8[p + 3] === 6) { eocd = p; break; }
    if (eocd < 0) throw bad();
    var count = u16(d, eocd + 10), cdSize = u32(d, eocd + 12), cdOff = u32(d, eocd + 16);
    if ((count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) && eocd >= 20 && u32(d, eocd - 20) === 0x07064b50) {
      var z = u64(d, eocd - 20 + 8);
      if (z + 56 <= u8.length && u32(d, z) === 0x06064b50) { count = u64(d, z + 32); cdSize = u64(d, z + 40); cdOff = u64(d, z + 48); }
    }
    if (!isFinite(count) || !isFinite(cdSize) || !isFinite(cdOff)) throw bad();
    var shift = 0;                                              // zips with something in front (self-extracting, email) keep offsets relative to the zip's own start
    if (cdOff + cdSize > eocd || u32(d, cdOff) !== 0x02014b50) { shift = eocd - cdSize - cdOff; if (shift < 0 || u32(d, cdOff + shift) !== 0x02014b50) { if (count) throw bad(); } }
    var entries = [], notes = [], q = cdOff + shift, seen = 0, truncated = false;
    while (seen < count && q + 46 <= u8.length && u32(d, q) === 0x02014b50) {
      if (entries.length >= lim.maxEntries) { truncated = true; break; }
      var flags = u16(d, q + 8), method = u16(d, q + 10), crc = u32(d, q + 16), csize = u32(d, q + 20), usize = u32(d, q + 24);
      var nl = u16(d, q + 28), el = u16(d, q + 30), cl = u16(d, q + 32), off = u32(d, q + 42);
      if (q + 46 + nl + el + cl > u8.length) break;
      var name = decodeName(u8.subarray(q + 46, q + 46 + nl), (flags & 0x800) !== 0);
      if (csize === 0xffffffff || usize === 0xffffffff || off === 0xffffffff) {   // zip64 extra field: only the fields that were maxed out appear, in this order
        var ep = q + 46 + nl, end = ep + el;
        while (ep + 4 <= end) {
          var id = u16(d, ep), sz = u16(d, ep + 2), fp = ep + 4;
          if (id === 1) {
            if (usize === 0xffffffff && fp + 8 <= end) { usize = u64(d, fp); fp += 8; }
            if (csize === 0xffffffff && fp + 8 <= end) { csize = u64(d, fp); fp += 8; }
            if (off === 0xffffffff && fp + 8 <= end) { off = u64(d, fp); fp += 8; }
            break;
          }
          ep += 4 + sz;
        }
      }
      var path = cleanPath(name), isDir = /\/$/.test(name.replace(/\\/g, '/'));
      entries.push({ path: path, rawName: name, method: method, flags: flags, crc: crc, csize: csize, usize: usize, start: off + shift, dir: isDir });
      q += 46 + nl + el + cl; seen++;
    }
    if (truncated) notes.push('This zip lists more than ' + lim.maxEntries + ' files; only the first ' + lim.maxEntries + ' were looked at.');
    else if (seen < count) notes.push('The zip\'s table of contents is shorter than it says; ' + seen + ' of ' + count + ' files could be found.');
    return { entries: entries, notes: notes };
  }

  function noop() {}
  /** Raw deflate -> bytes, never more than `limit` bytes. */
  async function inflateRaw(src, limit) {
    if (typeof DecompressionStream === 'function') {
      var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(), rd = ds.readable.getReader(), chunks = [], total = 0;
      var feeding = w.write(src).then(function () { return w.close(); }).catch(function () { /* the read side reports it */ });
      try {
        for (;;) {
          var r = await rd.read();
          if (r.done) break;
          total += r.value.length;
          if (total > limit) { var tooBig = new Error('TOOBIG'); throw tooBig; }
          chunks.push(r.value);
        }
      } catch (e) {
        try { rd.cancel().catch(noop); } catch (e2) { /* already closed */ }
        try { w.abort().catch(noop); } catch (e3) { /* already closed */ }
        throw e;
      }
      await feeding;
      var out = new Uint8Array(total), at = 0;
      for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], at); at += chunks[i].length; }
      return out;
    }
    var zlib = require('zlib');
    try { var b = zlib.inflateRawSync(src, { maxOutputLength: limit }); return new Uint8Array(b.buffer, b.byteOffset, b.length); }
    catch (e) { if (e && (e.code === 'ERR_BUFFER_TOO_LARGE' || /larger than|maxOutputLength/i.test(e.message))) throw new Error('TOOBIG'); throw e; }
  }

  /** Bytes of one entry, or { skip: 'plain-words reason' }. Verifies size and checksum against what the file promised. */
  async function readEntry(u8, e, limit) {
    if (e.flags & 1) return { skip: 'is password-protected' };
    if (e.method !== 0 && e.method !== 8) return { skip: 'uses a compression method I can\'t open' };
    if (e.usize > limit) return { skip: 'is too large to open (over ' + Math.round(limit / 1e6) + ' MB)' };
    var d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (e.start + 30 > u8.length || u32(d, e.start) !== 0x04034b50) return { skip: 'looks damaged' };
    var data = e.start + 30 + u16(d, e.start + 26) + u16(d, e.start + 28);
    if (data + e.csize > u8.length) return { skip: 'looks damaged (cut off)' };
    var body = u8.subarray(data, data + e.csize), out;
    if (e.method === 0) { if (e.csize > limit) return { skip: 'is too large to open (over ' + Math.round(limit / 1e6) + ' MB)' }; out = body; }
    else {
      try { out = await inflateRaw(body, Math.min(limit, e.usize + 1)); }
      catch (err) { return { skip: err && err.message === 'TOOBIG' ? 'unpacks to more than it says it does (skipped for safety)' : 'looks damaged' }; }
    }
    if (out.length !== e.usize) return { skip: 'looks damaged (its size is not what the zip says)' };
    if (crc32(out) !== e.crc) return { skip: 'looks damaged (its checksum does not match)' };
    return { bytes: out };
  }

  function decodeText(u8) {
    if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
    if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.subarray(2));
    var n = Math.min(u8.length, 8192);
    for (var i = 0; i < n; i++) if (u8[i] === 0) return null;      // binary
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); } catch (e) { return new TextDecoder('windows-1252').decode(u8); }
  }

  function extOf(p) { var m = /\.([a-z0-9]+)$/i.exec(p); return m ? m[1].toLowerCase() : ''; }
  function baseOf(p) { return p.split('/').pop(); }
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }

  /**
   * bytes: Uint8Array of a .zip or .xlsx. Returns { files: [{ name, path, text }], notes: [plain words] }.
   * Never throws for a bad inner file (it is skipped with a note); throws for a bad outer file or when nothing readable is inside.
   */
  async function expand(bytes, fileName, opts) {
    var lim = Object.assign({}, LIMITS, opts || {}), ctx = { lim: lim, files: [], notes: [], total: 0, other: {}, stopped: false };
    var label = baseOf(fileName || 'archive');
    await openArchive(bytes, label, '', ctx, 0, /\.(xlsx|xlsm)$/i.test(label));
    var otherN = 0, otherExt = [];
    Object.keys(ctx.other).forEach(function (k) { otherN += ctx.other[k]; otherExt.push(k ? '.' + k : 'no extension'); });
    if (otherN) ctx.notes.push(otherN + ' file' + (otherN === 1 ? '' : 's') + ' of other kinds (' + otherExt.slice(0, 6).join(', ') + (otherExt.length > 6 ? ', …' : '') + ') ' + (otherN === 1 ? 'was' : 'were') + ' left alone.');
    if (!ctx.files.length) throw new Error('There were no files I can read inside ' + label + '. I read zips of CSV, tab/semicolon/bar-separated text, JSON, Markdown and text notes, arrow lines, Excel (.xlsx), GraphML, GEXF, GML and DOT files.' + (ctx.notes.length ? ' ' + ctx.notes.slice(0, 3).join(' ') : ''));
    return { files: ctx.files, notes: ctx.notes };
  }

  async function openArchive(bytes, label, prefix, ctx, depth, asBook) {
    var lim = ctx.lim, toc;
    try { toc = list(bytes, lim); } catch (e) { if (depth === 0) throw e; ctx.notes.push('"' + label + '" is not a zip I can open; skipped.'); return; }
    toc.notes.forEach(function (n) { ctx.notes.push(n); });
    var entries = toc.entries.filter(function (e) { return !e.dir && e.path && !JUNK.test(e.path); });
    // a workbook is a zip too: gather its parts, then turn each sheet into a table
    var isBook = asBook || entries.some(function (e) { return e.path === 'xl/workbook.xml'; }) && entries.some(function (e) { return e.path === '[Content_Types].xml'; });
    if (isBook) return openBook(bytes, entries, label, prefix, ctx);
    entries.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i], ext = extOf(e.path), shown = prefix + e.path;
      if (ctx.stopped) break;
      if (ext === 'xls' || ext === 'ods' || ext === 'numbers') { ctx.notes.push('"' + shown + '" is a spreadsheet kind I can\'t open' + (ext === 'xls' ? ' (the old Excel format). In Excel, choose Save As and pick .xlsx or CSV.' : '. Export it as .xlsx or CSV.')); continue; }
      var kind = ext === 'zip' ? 'zip' : ext === 'xlsx' || ext === 'xlsm' ? 'book' : TEXT_EXT.test(e.path) ? 'text' : null;
      if (!kind) { ctx.other[ext] = (ctx.other[ext] || 0) + 1; continue; }
      if (kind === 'text' && ctx.files.length >= lim.maxFiles) { if (!ctx.capNoted) { ctx.capNoted = true; ctx.notes.push('Only the first ' + lim.maxFiles + ' files were read.'); } continue; }
      if (kind === 'zip' && depth + 1 >= lim.maxDepth) { ctx.notes.push('"' + shown + '" is a zip inside zips inside zips; skipped.'); continue; }
      var left = lim.maxTotalBytes - ctx.total, room = Math.min(kind === 'text' ? lim.maxEntryBytes : lim.maxTotalBytes, left);
      if (room <= 0 || (e.usize > left && e.usize <= (kind === 'text' ? lim.maxEntryBytes : Infinity))) { ctx.stopped = true; ctx.notes.push('Stopped opening files after ' + Math.round(lim.maxTotalBytes / 1e6) + ' MB of unpacked data (a safety limit).'); break; }
      var got = await readEntry(bytes, e, kind === 'text' ? Math.min(lim.maxEntryBytes, room) : room);
      if (got.skip) { ctx.notes.push('"' + shown + '" ' + got.skip + '; skipped.'); continue; }
      ctx.total += got.bytes.length;
      if (kind === 'text') {
        var text = decodeText(got.bytes);
        if (text === null) { ctx.notes.push('"' + shown + '" looks like a binary file, not text; skipped.'); continue; }
        ctx.files.push({ name: baseOf(e.path), path: shown, text: text });
      } else await openArchive(got.bytes, baseOf(e.path), shown + '!/', ctx, depth + 1, kind === 'book');
    }
  }

  async function openBook(bytes, entries, label, prefix, ctx) {
    var lim = ctx.lim, wanted = /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^\/]+\.xml)$/i, parts = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!wanted.test(e.path)) continue;
      var room = Math.min(lim.maxPartBytes, lim.maxTotalBytes - ctx.total);
      if (room <= 0) { ctx.stopped = true; ctx.notes.push('Stopped opening the workbook after ' + Math.round(lim.maxTotalBytes / 1e6) + ' MB of unpacked data (a safety limit).'); break; }
      var got = await readEntry(bytes, e, room);
      if (got.skip) { ctx.notes.push('Part "' + e.path + '" of "' + label + '" ' + got.skip + '; skipped.'); continue; }
      ctx.total += got.bytes.length;
      parts[e.path.replace(/^xl\/worksheets\//i, 'xl/worksheets/')] = decodeText(got.bytes) || '';
    }
    if (!parts['xl/workbook.xml']) { ctx.notes.push('"' + label + '" does not look like an Excel workbook; skipped.'); return; }
    var sheets;
    try { sheets = IMP.xlsxSheets(parts, {}); } catch (err) { ctx.notes.push('"' + label + '" could not be read as a workbook (' + String(err && err.message || err).replace(/\.$/, '') + '); skipped.'); return; }
    if (!sheets.length) { ctx.notes.push('"' + label + '" has no cells with data.'); return; }
    var stem = label.replace(/\.(xlsx|xlsm)$/i, '');
    sheets.forEach(function (sh) {
      if (ctx.files.length >= lim.maxFiles) return;
      var nm = (sheets.length > 1 ? stem + ' - ' + sh.sheet : stem).replace(/[\/\\:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120) + '.csv';
      ctx.files.push({ name: nm, path: prefix + nm, text: sh.csv });
      if (sh.truncated) ctx.notes.push('Sheet "' + sh.sheet + '" is very long; only its first rows were read.');
    });
    if (sheets.length > 1) ctx.notes.push('"' + label + '" has ' + sheets.length + ' sheets; each was read as its own table and they were merged by name.');
  }

  /** Quick check on the first bytes of a dropped file. */
  function looksLikeArchive(u8, fileName) { return isZip(u8) || /\.(zip|xlsx|xlsm)$/i.test(fileName || ''); }

  return { expand: expand, list: list, isZip: isZip, looksLikeArchive: looksLikeArchive, decodeText: decodeText, crc32: crc32, LIMITS: LIMITS };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMUnpack;
