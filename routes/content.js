const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener toda la configuración del sitio
router.get('/config', (req, res) => {
  db.all('SELECT key, value, type FROM site_config ORDER BY key', (err, configs) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la configuración' });
    }

    const configObject = {};
    configs.forEach(config => {
      configObject[config.key] = config.value;
    });

    res.json(configObject);
  });
});

// Obtener configuración para el admin
router.get('/config/admin', authenticateToken, requireAdmin, (req, res) => {
  db.all('SELECT * FROM site_config ORDER BY key', (err, configs) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la configuración' });
    }
    res.json(configs);
  });
});

// Actualizar configuración
router.put('/config', [
  authenticateToken,
  requireAdmin,
  body('configs').isArray().withMessage('Los datos de configuración deben ser un array')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { configs } = req.body;
    
    // Preparar consultas de actualización
    const updatePromises = configs.map(config => {
      return new Promise((resolve, reject) => {
        db.run(
          'UPDATE site_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
          [config.value, config.key],
          function(err) {
            if (err) {
              reject(err);
            } else {
              resolve(this.changes);
            }
          }
        );
      });
    });

    Promise.all(updatePromises)
      .then(() => {
        res.json({ success: true, message: 'Configuración actualizada correctamente' });
      })
      .catch(error => {
        res.status(500).json({ error: 'Error al actualizar la configuración' });
      });

  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar configuración individual
router.put('/config/:key', [
  authenticateToken,
  requireAdmin,
  body('value').notEmpty().withMessage('El valor es requerido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { key } = req.params;
    const { value } = req.body;

    db.run(
      'UPDATE site_config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
      [value, key],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar la configuración' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        
        res.json({ success: true, message: 'Configuración actualizada correctamente' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;