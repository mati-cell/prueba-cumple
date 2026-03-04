const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

// Configuración (lee desde variables de entorno en CI; mantiene fallback local para pruebas)
const EMAIL_REMITENTE = process.env.EMAIL_REMITENTE || 'uruguay@betar.org.il';
const CONTRASENA = process.env.EMAIL_PASS || process.env.EMAIL_PASSWD || 'obxe xvis pmqc zxmm';
// Buscar la imagen con la extensión correcta (.jpg, .jpeg, .png)
const possibleNames = ['feliz_cumple.jpg', 'feliz_cumple.jpeg', 'feliz_cumple.png'];
let imgPath = null;
for (const name of possibleNames) {
  const p = path.join(__dirname, name);
  if (fs.existsSync(p)) {
    imgPath = p;
    break;
  }
}
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1duEAzFEHCoT8Z4-Y2DWmwnCVrtmuxayJYsaGrqCqmkE'; // puedes sobreescribir con env var
const SHEET_NAME = 'Respuestas de formulario 1'; // Nombre de la hoja según la imagen

// Fecha de hoy
const hoy = new Date();
const diaHoy = hoy.getDate();
const mesHoy = hoy.getMonth() + 1;

// Configura el transporter de nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_REMITENTE,
    pass: CONTRASENA
  }
});

// Verificar conexión SMTP al iniciar para detectar problemas de autenticación
transporter.verify((err, success) => {
  if (err) console.log('Error verificando SMTP:', err);
  else console.log('Transporter listo para enviar correos');
});

// Autenticación con Google
async function getSheetData() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME,
  });
  return res.data.values;
}

(async () => {
  const rows = await getSheetData();
  // Public image URL: use env var if set, otherwise fall back to the raw GitHub URL the user provided
  const IMG_URL = process.env.IMG_URL || 'https://raw.githubusercontent.com/mati-cell/prueba-cumple/a8c15220509aae695c13c41cd4c4e7767b6fdb4f/feliz_cumple.jpg'; // override with your own public URL if needed
  const imgExists = imgPath ? fs.existsSync(imgPath) : false;
  const imgBuffer = imgExists ? fs.readFileSync(imgPath) : null;
  const imgBase64 = imgBuffer ? imgBuffer.toString('base64') : null;
  let imgMime = 'image/jpeg';
  if (imgPath) {
    const ext = path.extname(imgPath).toLowerCase();
    if (ext === '.png') imgMime = 'image/png';
    else if (ext === '.jpeg' || ext === '.jpg') imgMime = 'image/jpeg';
  }
   const headers = rows[0];
   for (let i = 1; i < rows.length; i++) {
     const row = rows[i];
     const obj = {};
     headers.forEach((h, idx) => obj[h] = row[idx]);
     const nombre = obj['Nombre'];
     const email = obj['Correo'];
     const fecha = obj['Fecha de nacimiento'];

    if (!fecha || !email || !nombre) continue;

    let dia, mes;
    if (typeof fecha === 'string' && fecha.includes('/')) {
      [dia, mes] = fecha.split('/').map(Number);
    } else if (typeof fecha === 'string' && fecha.includes('-')) {
      const partes = fecha.split('-');
      dia = Number(partes[2]);
      mes = Number(partes[1]);
    }

    if (dia === diaHoy && mes === mesHoy) {
      // Build image tag and attachments: prefer public IMG_URL; otherwise use CID attachment with Buffer.
      let attachments = [];
      let imgTag = '';
      if (IMG_URL) {
        // show large centered image when using public URL
        imgTag = `<img src="${IMG_URL}" alt="¡Feliz cumpleaños!" style="display:block;margin:0 auto;width:600px;max-width:100%;height:auto;"/>`;
      } else if (imgBuffer) {
         // Use CID attachment (more compatible than data URI for Gmail)
         imgTag = `<img src="cid:felizcumpleimg" alt="¡Feliz cumpleaños!" style="max-width:100%;height:auto;"/>`;
         attachments.push({
           filename: path.basename(imgPath),
           content: imgBuffer,
           cid: 'felizcumpleimg',
           contentType: imgMime
         });
       }

      const mailOptions = {
         from: EMAIL_REMITENTE,
         to: email,
         subject: `¡Feliz cumpleaños, ${nombre}!`,
         html: `
           <div style="text-align:center;">
             <h2>Hola ${nombre},</h2>
             ${imgTag}
           </div>
         `,
         attachments: attachments
       };
+
+      // Diagnostic logs
+      console.log('Enviando a:', email, 'nombre:', nombre);
+      console.log('Imagen existe:', imgExists, imgExists ? `tamaño=${fs.statSync(imgPath).size} bytes` : 'no existe');
+      console.log('HTML length:', mailOptions.html.length);
 
       transporter.sendMail(mailOptions, (error, info) => {
         if (error) {
           console.log(`Error enviando a ${nombre}:`, error);
         } else {
-          console.log(`Correo enviado a ${nombre} - ${email}`);
+          console.log(`Correo enviado a ${nombre} - ${email}`);
+          console.log('sendMail info:', { accepted: info.accepted, rejected: info.rejected, messageId: info.messageId, response: info.response });
         }
       });
    }
  }
})();