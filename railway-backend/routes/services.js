const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configuración de multer para subida de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/services';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Obtener todos los servicios (público)
router.get('/', (req, res) => {
  db.all(
    'SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC',
    (err, services) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener los servicios' });
      }
      res.json(services);
    }
  );
});

// Obtener todos los servicios (admin)
router.get('/admin', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM services ORDER BY sort_order ASC, created_at ASC',
    (err, services) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener los servicios' });
      }
      res.json(services);
    }
  );
});

// Obtener un servicio por ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM services WHERE id = ?', [id], (err, service) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el servicio' });
    }
    
    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    
    res.json(service);
  });
});

// Crear nuevo servicio
router.post('/', [
  authenticateToken,
  requireAdmin,
  upload.single('image'),
  body('title').notEmpty().withMessage('El título es requerido'),
  body('description').notEmpty().withMessage('La descripción es requerida')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      short_description,
      price_from,
      is_active = 1,
      sort_order = 0,
      seo_title,
      seo_description
    } = req.body;

    const image_url = req.file ? `/uploads/services/${req.file.filename}` : null;

    db.run(
      `INSERT INTO services 
       (title, description, short_description, price_from, image_url, is_active, sort_order, seo_title, seo_description) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, short_description, price_from, image_url, is_active, sort_order, seo_title, seo_description],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al crear el servicio' });
        }
        
        res.status(201).json({
          success: true,
          message: 'Servicio creado correctamente',
          serviceId: this.lastID
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar servicio
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  upload.single('image'),
  body('title').notEmpty().withMessage('El título es requerido'),
  body('description').notEmpty().withMessage('La descripción es requerida')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      title,
      description,
      short_description,
      price_from,
      is_active = 1,
      sort_order = 0,
      seo_title,
      seo_description
    } = req.body;

    // Primero obtener el servicio actual para manejar la imagen
    db.get('SELECT image_url FROM services WHERE id = ?', [id], (err, currentService) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener el servicio' });
      }

      let image_url = currentService ? currentService.image_url : null;
      
      // Si se subió una nueva imagen
      if (req.file) {
        // Eliminar imagen anterior si existe
        if (currentService && currentService.image_url) {
          const oldImagePath = path.join(__dirname, '..', currentService.image_url);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        image_url = `/uploads/services/${req.file.filename}`;
      }

      db.run(
        `UPDATE services SET 
         title = ?, description = ?, short_description = ?, price_from = ?, 
         image_url = ?, is_active = ?, sort_order = ?, seo_title = ?, seo_description = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title, description, short_description, price_from, image_url, is_active, sort_order, seo_title, seo_description, id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al actualizar el servicio' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
          }
          
          res.json({ success: true, message: 'Servicio actualizado correctamente' });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar servicio
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Primero obtener la imagen para eliminarla
  db.get('SELECT image_url FROM services WHERE id = ?', [id], (err, service) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el servicio' });
    }
    
    db.run('DELETE FROM services WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al eliminar el servicio' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Servicio no encontrado' });
      }
      
      // Eliminar imagen si existe
      if (service && service.image_url) {
        const imagePath = path.join(__dirname, '..', service.image_url);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      res.json({ success: true, message: 'Servicio eliminado correctamente' });
    });
  });
});

module.exports = router;