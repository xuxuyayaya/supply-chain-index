// Native WeChat module: creates an actual PDF in the mini program file system.
const content = require('./content');

function ascii(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 255;
  return bytes;
}

function imagePdf(imageBytes, width, height) {
  const chunks = [];
  const offsets = [0];
  let length = 0;
  const add = data => {
    const bytes = typeof data === 'string' ? ascii(data) : new Uint8Array(data);
    chunks.push(bytes); length += bytes.length;
  };
  const object = (n, body) => {
    offsets[n] = length;
    add(n + ' 0 obj\n' + body + '\nendobj\n');
  };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4] = length;
  const jpeg = new Uint8Array(imageBytes);
  add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + width +
      ' /Height ' + height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
  add(jpeg);
  add('\nendstream\nendobj\n');
  const stream = 'q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
  object(5, '<< /Length ' + ascii(stream).length + ' >>\nstream\n' + stream + 'endstream');
  const start = length;
  add('xref\n0 6\n0000000000 65535 f \n');
  for (let n = 1; n <= 5; n++) add(String(offsets[n]).padStart(10, '0') + ' 00000 n \n');
  add('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF');
  const result = new Uint8Array(length);
  let position = 0;
  chunks.forEach(chunk => { result.set(chunk, position); position += chunk.length; });
  return result.buffer;
}

function localTime(value) {
  const date = new Date(new Date(value).getTime() + 8 * 3600000);
  const pad = number => String(number).padStart(2, '0');
  return date.getUTCFullYear() + '/' + pad(date.getUTCMonth() + 1) + '/' + pad(date.getUTCDate()) +
    ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
}

function drawCertificate(canvas, record) {
  canvas.width = 1240;
  canvas.height = 1754;
  const ctx = canvas.getContext('2d');
  const left = 90, right = 1150, available = right - left;
  const lines = (text, width) => {
    const output = []; let line = '';
    Array.from(text).forEach(char => {
      if (line && ctx.measureText(line + char).width > width) {
        output.push(line); line = char;
      } else line += char;
    });
    if (line) output.push(line);
    return output;
  };
  const blocks = [{text:content.intro}].concat(content.sections).concat([{text:content.closing}]);
  const body = (size, paint) => {
    let y = 180;
    blocks.forEach(block => {
      if (block.title) {
        ctx.font = 'bold ' + size + 'px sans-serif';
        if (paint) ctx.fillText(block.title, left + size * 2, y);
        y += size * 1.5;
      }
      ctx.font = size + 'px serif';
      lines('　　' + block.text, available).forEach(line => {
        if (paint) ctx.fillText(line, left, y);
        y += size * 1.65;
      });
      y += size * 0.65;
    });
    return y;
  };
  const signatureHeight = size => {
    ctx.font = size + 'px sans-serif';
    return lines(record.company, available - 160).length * (size + 8);
  };
  let size = 28;
  while (size > 18 && body(size, false) + 185 + signatureHeight(size) > 1650) size--;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1240, 1754);
  ctx.fillStyle = '#111111'; ctx.textAlign = 'center';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(content.title, 620, 100);
  ctx.textAlign = 'left';
  let y = body(size, true) + 20;
  ctx.font = '25px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(content.issuer, right, y);
  ctx.fillText(content.date, right, y + 40);
  y += 115; ctx.textAlign = 'left';
  ctx.font = '26px sans-serif';
  ctx.fillText('响应单位', left, y);
  lines(record.company, available - 160).forEach((line, index) => {
    const baseline = y + index * 34;
    ctx.fillText(line, left + 150, baseline);
    ctx.beginPath(); ctx.moveTo(left + 135, baseline + 12); ctx.lineTo(right, baseline + 12); ctx.stroke();
  });
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#555555';
  ctx.fillText('响应时间 ' + localTime(record.confirmedAt), left, 1690);
}

function wxCall(method, params) {
  return new Promise((resolve, reject) => method(Object.assign({}, params, {success:resolve, fail:reject})));
}

async function generate(page, record) {
  if (!record || !record.company || !record.confirmedAt) throw new Error('缺少响应记录');
  const canvas = await new Promise((resolve, reject) => {
    wx.createSelectorQuery().in(page).select('#certificateCanvas')
      .fields({node:true, size:true}).exec(result => {
        if (!result[0] || !result[0].node) reject(new Error('凭证画布未准备好，请重试'));
        else resolve(result[0].node);
      });
  });
  drawCertificate(canvas, record);
  const image = await wxCall(wx.canvasToTempFilePath, {
    canvas, x:0, y:0, width:1240, height:1754, destWidth:1240, destHeight:1754,
    fileType:'jpg', quality:0.96
  });
  const fs = wx.getFileSystemManager();
  const bytes = fs.readFileSync(image.tempFilePath);
  const pdf = imagePdf(bytes, 1240, 1754);
  const filename = ('倡议响应凭证-' + record.company).replace(/[\\/:*?"<>|\u0000-\u001F]/g, '').slice(0, 95) + '.pdf';
  const path = wx.env.USER_DATA_PATH + '/' + filename;
  fs.writeFileSync(path, pdf);
  return path;
}

module.exports = {generate, localTime};
