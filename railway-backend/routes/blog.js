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

// Configuración de multer para blog
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/blog';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `blog-${uniqueSuffix}${path.extname(file.originalname)}`);
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

// Obtener posts del blog (público)
router.get('/', (req, res) => {
  const { limit = 10, offset = 0 } = req.query;
  
  db.all(
    'SELECT id, title, slug, excerpt, featured_image, author, created_at FROM blog_posts WHERE is_published = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [parseInt(limit), parseInt(offset)],
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener los posts' });
      }
      res.json(posts);
    }
  );
});

// Obtener posts del blog (admin)
router.get('/admin', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM blog_posts ORDER BY created_at DESC',
    (err, posts) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener los posts' });
      }
      
      // Parsear tags
      const postsWithParsedTags = posts.map(post => ({
        ...post,
        tags: post.tags ? JSON.parse(post.tags) : []
      }));
      
      res.json(postsWithParsedTags);
    }
  );
});

// Obtener un post por slug (público)
router.get('/:slug', (req, res) => {
  const { slug } = req.params;
  
  db.get(
    'SELECT * FROM blog_posts WHERE slug = ? AND is_published = 1',
    [slug],
    (err, post) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener el post' });
      }
      
      if (!post) {
        return res.status(404).json({ error: 'Post no encontrado' });
      }
      
      // Parsear tags
      const postWithParsedTags = {
        ...post,
        tags: post.tags ? JSON.parse(post.tags) : []
      };
      
      res.json(postWithParsedTags);
    }
  );
});

// Obtener un post por ID (admin)
router.get('/admin/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM blog_posts WHERE id = ?', [id], (err, post) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el post' });
    }
    
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    
    const postWithParsedTags = {
      ...post,
      tags: post.tags ? JSON.parse(post.tags) : []
    };
    
    res.json(postWithParsedTags);
  });
});

// Crear nuevo post
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
      tags = [],
      is_published = 0,
      seo_title,
      seo_description
    } = req.body;

    const slug = generateSlug(title);
    const featured_image = req.file ? `/uploads/blog/${req.file.filename}` : null;
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    // Verificar que el slug sea único
    db.get('SELECT id FROM blog_posts WHERE slug = ?', [slug], (err, existingPost) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar el slug' });
      }

      if (existingPost) {
        return res.status(400).json({ error: 'Ya existe un post con ese título' });
      }

      db.run(
        `INSERT INTO blog_posts 
         (title, slug, content, excerpt, featured_image, author, tags, is_published, seo_title, seo_description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, slug, content, excerpt, featured_image, author, tagsJson, is_published, seo_title, seo_description],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al crear el post' });
          }
          
          res.status(201).json({
            success: true,
            message: 'Post creado correctamente',
            postId: this.lastID,
            slug
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar post
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
      tags = [],
      is_published = 0,
      seo_title,
      seo_description
    } = req.body;

    const slug = generateSlug(title);
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    // Obtener post actual
    db.get('SELECT * FROM blog_posts WHERE id = ?', [id], (err, currentPost) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener el post' });
      }

      if (!currentPost) {
        return res.status(404).json({ error: 'Post no encontrado' });
      }

      let featured_image = currentPost.featured_image;
      
      // Manejar nueva imagen
      if (req.file) {
        if (currentPost.featured_image) {
          const oldPath = path.join(__dirname, '..', currentPost.featured_image);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        featured_image = `/uploads/blog/${req.file.filename}`;
      }

      db.run(
        `UPDATE blog_posts SET 
         title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, 
         author = ?, tags = ?, is_published = ?, seo_title = ?, seo_description = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title, slug, content, excerpt, featured_image, author, tagsJson, is_published, seo_title, seo_description, id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al actualizar el post' });
          }
          
          res.json({ success: true, message: 'Post actualizado correctamente' });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar post
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // Obtener post para eliminar imagen
  db.get('SELECT featured_image FROM blog_posts WHERE id = ?', [id], (err, post) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el post' });
    }
    
    db.run('DELETE FROM blog_posts WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al eliminar el post' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Post no encontrado' });
      }
      
      // Eliminar imagen si existe
      if (post && post.featured_image) {
        const imagePath = path.join(__dirname, '..', post.featured_image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      res.json({ success: true, message: 'Post eliminado correctamente' });
    });
  });
});

module.exports = router;