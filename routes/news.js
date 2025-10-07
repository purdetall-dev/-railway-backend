const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Función para generar slug
function generateSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remover acentos
    .replace(/[^a-z0-9 -]/g, '') // remover caracteres especiales
    .replace(/\s+/g, '-') // espacios a guiones
    .replace(/-+/g, '-') // múltiples guiones a uno
    .trim('-');
}

// Configuración de multer para noticias
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/news';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `news-${uniqueSuffix}${path.extname(file.originalname)}`);
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

// Obtener noticias (público)
router.get('/', (req, res) => {
  const { limit = 10, offset = 0, category } = req.query;
  
  let query = 'SELECT id, title, slug, excerpt, featured_image, author, category, created_at FROM news WHERE is_published = 1';
  let params = [];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, news) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener las noticias' });
    }
    res.json(news);
  });
});

// Obtener categorías de noticias
router.get('/categories', (req, res) => {
  db.all(
    'SELECT DISTINCT category FROM news WHERE is_published = 1 AND category IS NOT NULL ORDER BY category',
    (err, categories) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener las categorías' });
      }
      res.json(categories.map(cat => cat.category));
    }
  );
});

// Obtener noticias (admin)
router.get('/admin', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM news ORDER BY created_at DESC',
    (err, news) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener las noticias' });
      }
      res.json(news);
    }
  );
});

// Obtener una noticia por slug (público)
router.get('/:slug', (req, res) => {
  const { slug } = req.params;
  
  db.get(
    'SELECT * FROM news WHERE slug = ? AND is_published = 1',
    [slug],
    (err, news) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la noticia' });
      }
      
      if (!news) {
        return res.status(404).json({ error: 'Noticia no encontrada' });
      }
      
      res.json(news);
    }
  );
});

// Obtener una noticia por ID (admin)
router.get('/admin/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM news WHERE id = ?', [id], (err, news) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la noticia' });
    }
    
    if (!news) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }
    
    res.json(news);
  });
});

// Crear nueva noticia
router.post('/', [
  authenticateToken,
  requireAdmin,
  upload.single('featured_image'),
  body('title').notEmpty().withMessage('El título es requerido'),
  body('content').notEmpty().withMessage('El contenido es requerido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      content,
      excerpt,
      author = 'PurDetall',
      category,
      is_published = 0,
      seo_title,
      seo_description
    } = req.body;

    const slug = generateSlug(title);
    const featured_image = req.file ? `/uploads/news/${req.file.filename}` : null;

    // Verificar que el slug sea único
    db.get('SELECT id FROM news WHERE slug = ?', [slug], (err, existingNews) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar el slug' });
      }

      if (existingNews) {
        return res.status(400).json({ error: 'Ya existe una noticia con ese título' });
      }

      db.run(
        `INSERT INTO news 
         (title, slug, content, excerpt, featured_image, author, category, is_published, seo_title, seo_description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, slug, content, excerpt, featured_image, author, category, is_published, seo_title, seo_description],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al crear la noticia' });
          }
          
          res.status(201).json({
            success: true,
            message: 'Noticia creada correctamente',
            newsId: this.lastID,
            slug
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar noticia
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  upload.single('featured_image'),
  body('title').notEmpty().withMessage('El título es requerido'),
  body('content').notEmpty().withMessage('El contenido es requerido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      title,
      content,
      excerpt,
      author = 'PurDetall',
      category,
      is_published = 0,
      seo_title,
      seo_description
    } = req.body;

    const slug = generateSlug(title);

    // Obtener noticia actual
    db.get('SELECT * FROM news WHERE id = ?', [id], (err, currentNews) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la noticia' });
      }

      if (!currentNews) {
        return res.status(404).json({ error: 'Noticia no encontrada' });
      }

      let featured_image = currentNews.featured_image;
      
      // Manejar nueva imagen
      if (req.file) {
        if (currentNews.featured_image) {
          const oldPath = path.join(__dirname, '..', currentNews.featured_image);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        featured_image = `/uploads/news/${req.file.filename}`;
      }

      db.run(
        `UPDATE news SET 
         title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, 
         author = ?, category = ?, is_published = ?, seo_title = ?, seo_description = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title, slug, content, excerpt, featured_image, author, category, is_published, seo_title, seo_description, id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al actualizar la noticia' });
          }
          
          res.json({ success: true, message: 'Noticia actualizada correctamente' });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar noticia
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Obtener noticia para eliminar imagen
  db.get('SELECT featured_image FROM news WHERE id = ?', [id], (err, news) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la noticia' });
    }
    
    db.run('DELETE FROM news WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al eliminar la noticia' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Noticia no encontrada' });
      }
      
      // Eliminar imagen si existe
      if (news && news.featured_image) {
        const imagePath = path.join(__dirname, '..', news.featured_image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      res.json({ success: true, message: 'Noticia eliminada correctamente' });
    });
  });
});

module.exports = router;