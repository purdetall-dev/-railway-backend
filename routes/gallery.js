const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configuración de multer para galería
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/gallery';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname === 'before_image' ? 'before' : 'after';
    cb(null, `gallery-${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
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

// Obtener galería (público)
router.get('/', (req, res) => {
  const query = `
    SELECT g.*, s.title as service_title 
    FROM gallery g
    LEFT JOIN services s ON g.service_id = s.id
    ORDER BY g.is_featured DESC, g.sort_order ASC, g.created_at DESC
  `;
  
  db.all(query, (err, gallery) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la galería' });
    }
    res.json(gallery);
  });
});

// Obtener galería destacada
router.get('/featured', (req, res) => {
  const query = `
    SELECT g.*, s.title as service_title 
    FROM gallery g
    LEFT JOIN services s ON g.service_id = s.id
    WHERE g.is_featured = 1
    ORDER BY g.sort_order ASC, g.created_at DESC
  `;
  
  db.all(query, (err, gallery) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la galería destacada' });
    }
    res.json(gallery);
  });
});

// Obtener galería (admin)
router.get('/admin', authenticateToken, requireAdmin, (req, res) => {
  const query = `
    SELECT g.*, s.title as service_title 
    FROM gallery g
    LEFT JOIN services s ON g.service_id = s.id
    ORDER BY g.created_at DESC
  `;
  
  db.all(query, (err, gallery) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la galería' });
    }
    res.json(gallery);
  });
});

// Crear nueva entrada de galería
router.post('/', [
  authenticateToken,
  requireAdmin,
  upload.fields([{ name: 'before_image', maxCount: 1 }, { name: 'after_image', maxCount: 1 }]),
  body('title').notEmpty().withMessage('El título es requerido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      service_id,
      is_featured = 0,
      sort_order = 0
    } = req.body;

    const before_image = req.files && req.files.before_image ? `/uploads/gallery/${req.files.before_image[0].filename}` : null;
    const after_image = req.files && req.files.after_image ? `/uploads/gallery/${req.files.after_image[0].filename}` : null;

    if (!before_image || !after_image) {
      return res.status(400).json({ error: 'Se requieren tanto la imagen "antes" como "después"' });
    }

    db.run(
      `INSERT INTO gallery (title, description, before_image, after_image, service_id, is_featured, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, description, before_image, after_image, service_id, is_featured, sort_order],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al crear la entrada de galería' });
        }
        
        res.status(201).json({
          success: true,
          message: 'Entrada de galería creada correctamente',
          galleryId: this.lastID
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar entrada de galería
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  upload.fields([{ name: 'before_image', maxCount: 1 }, { name: 'after_image', maxCount: 1 }]),
  body('title').notEmpty().withMessage('El título es requerido')
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
      service_id,
      is_featured = 0,
      sort_order = 0
    } = req.body;

    // Obtener entrada actual
    db.get('SELECT * FROM gallery WHERE id = ?', [id], (err, currentEntry) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la entrada' });
      }

      if (!currentEntry) {
        return res.status(404).json({ error: 'Entrada de galería no encontrada' });
      }

      let before_image = currentEntry.before_image;
      let after_image = currentEntry.after_image;

      // Manejar nueva imagen "antes"
      if (req.files && req.files.before_image) {
        if (currentEntry.before_image) {
          const oldPath = path.join(__dirname, '..', currentEntry.before_image);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        before_image = `/uploads/gallery/${req.files.before_image[0].filename}`;
      }

      // Manejar nueva imagen "después"
      if (req.files && req.files.after_image) {
        if (currentEntry.after_image) {
          const oldPath = path.join(__dirname, '..', currentEntry.after_image);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        after_image = `/uploads/gallery/${req.files.after_image[0].filename}`;
      }

      db.run(
        `UPDATE gallery SET 
         title = ?, description = ?, before_image = ?, after_image = ?, 
         service_id = ?, is_featured = ?, sort_order = ?
         WHERE id = ?`,
        [title, description, before_image, after_image, service_id, is_featured, sort_order, id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al actualizar la entrada' });
          }
          
          res.json({ success: true, message: 'Entrada actualizada correctamente' });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar entrada de galería
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Obtener la entrada para eliminar las imágenes
  db.get('SELECT * FROM gallery WHERE id = ?', [id], (err, entry) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la entrada' });
    }
    
    if (!entry) {
      return res.status(404).json({ error: 'Entrada no encontrada' });
    }
    
    db.run('DELETE FROM gallery WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al eliminar la entrada' });
      }
      
      // Eliminar imágenes
      if (entry.before_image) {
        const beforePath = path.join(__dirname, '..', entry.before_image);
        if (fs.existsSync(beforePath)) {
          fs.unlinkSync(beforePath);
        }
      }
      
      if (entry.after_image) {
        const afterPath = path.join(__dirname, '..', entry.after_image);
        if (fs.existsSync(afterPath)) {
          fs.unlinkSync(afterPath);
        }
      }
      
      res.json({ success: true, message: 'Entrada eliminada correctamente' });
    });
  });
});

module.exports = router;