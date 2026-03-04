const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

// Configuración
const EMAIL_REMITENTE = 'uruguay@betar.org.il';
const CONTRASENA = 'obxe xvis pmqc zxmm';
const imgPath = path.join(__dirname, 'feliz_cumple.jpg');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SPREADSHEET_ID = '1Kw7kgg4ModMLgDHrsoAE9FxwhiHRWjUxKq7L86hh9pM'; // Copia el ID de tu Google Sheet de la URL
const SHEET_NAME = 'Base automatica'; // Nombre de la hoja según la imagen

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
  const headers = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    headers.forEach((h, idx) => obj[h] = row[idx]);
    const nombre = obj['Nombre y Apellido'];
    const email = obj['Mail de contacto'];
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
      const mailOptions = {
        from: EMAIL_REMITENTE,
        to: email,
        subject: `¡Feliz cumpleaños, ${nombre}!`,
        html: `
          <div style="text-align:center;">
            <h2>Hola ${nombre},</h2>
            <p>¡Tu tnuá te desea un muy felíz cumpleaños! 💙💛</p>
            <img src="cid:felizcumpleimg" style="max-width:100%;height:auto;"/>
            <p>Por mas momentos juntos,<br>Betar<br><b>Tel Jai.</b></p>
          </div>
        `,
        attachments: fs.existsSync(imgPath) ? [{
          filename: 'feliz_cumple.jpg',
          path: imgPath,
          cid: 'felizcumpleimg'
        }] : []
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(`Error enviando a ${nombre}:`, error);
        } else {
          console.log(`Correo enviado a ${nombre} - ${email}`);
        }
      });
    }
  }
})();