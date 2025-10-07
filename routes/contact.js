const express = require('express');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const db = require('../database/init');

const router = express.Router();

// Configurar nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Enviar mensaje de contacto
router.post('/', [
  body('name').notEmpty().withMessage('El nombre es requerido'),
  body('email').isEmail().withMessage('Email válido requerido'),
  body('message').notEmpty().withMessage('El mensaje es requerido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, subject, message } = req.body;

    // Obtener configuración del sitio
    db.get('SELECT value FROM site_config WHERE key = "contact_email"', (err, config) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la configuración' });
      }

      const contactEmail = config ? config.value : 'info@purdetall.es';

      // Preparar el email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: contactEmail,
        subject: `Nuevo mensaje de contacto: ${subject || 'Sin asunto'}`,
        html: `
          <h2>Nuevo mensaje de contacto - PurDetall</h2>
          <p><strong>Nombre:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Teléfono:</strong> ${phone}</p>` : ''}
          <p><strong>Asunto:</strong> ${subject || 'Sin asunto'}</p>
          <h3>Mensaje:</h3>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <small>Este mensaje fue enviado desde el formulario de contacto de PurDetall</small>
        `
      };

      // Enviar email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error enviando email:', error);
          return res.status(500).json({ error: 'Error al enviar el mensaje' });
        }
        
        res.json({ 
          success: true, 
          message: 'Mensaje enviado correctamente. Te contactaremos pronto.' 
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener información de contacto
router.get('/info', (req, res) => {
  const contactKeys = [
    'contact_phone', 'contact_email', 'contact_address', 
    'whatsapp_number', 'whatsapp_message', 'business_hours',
    'facebook_url', 'instagram_url', 'youtube_url'
  ];
  
  db.all(
    `SELECT key, value FROM site_config WHERE key IN (${contactKeys.map(() => '?').join(',')})`,
    contactKeys,
    (err, configs) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la información de contacto' });
      }
      
      const contactInfo = {};
      configs.forEach(config => {
        contactInfo[config.key] = config.value;
      });
      
      res.json(contactInfo);
    }
  );
});

module.exports = router;
