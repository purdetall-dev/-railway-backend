const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todos los clientes
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM clients ORDER BY created_at DESC',
    (err, clients) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener los clientes' });
      }
      res.json(clients);
    }
  );
});

// Obtener un cliente por ID
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM clients WHERE id = ?', [id], (err, client) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el cliente' });
    }
    
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    // Obtener historial de citas del cliente
    db.all(
      'SELECT * FROM appointments WHERE client_id = ? ORDER BY created_at DESC',
      [id],
      (err, appointments) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener el historial' });
        }
        
        res.json({ ...client, appointments });
      }
    );
  });
});

// Crear nuevo cliente
router.post('/', [
  authenticateToken,
  requireAdmin,
  body('name').notEmpty().withMessage('El nombre es requerido'),
  body('email').optional().isEmail().withMessage('Email inválido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, phone, address, notes } = req.body;

    db.run(
      'INSERT INTO clients (name, email, phone, address, notes) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, address, notes],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al crear el cliente' });
        }
        
        res.status(201).json({
          success: true,
          message: 'Cliente creado correctamente',
          clientId: this.lastID
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar cliente
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  body('name').notEmpty().withMessage('El nombre es requerido'),
  body('email').optional().isEmail().withMessage('Email inválido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, email, phone, address, notes } = req.body;

    db.run(
      'UPDATE clients SET name = ?, email = ?, phone = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, email, phone, address, notes, id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar el cliente' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        
        res.json({ success: true, message: 'Cliente actualizado correctamente' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar cliente
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM clients WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar el cliente' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json({ success: true, message: 'Cliente eliminado correctamente' });
  });
});

// Buscar clientes
router.get('/search/:term', authenticateToken, requireAdmin, (req, res) => {
  const { term } = req.params;
  const searchTerm = `%${term}%`;
  
  db.all(
    'SELECT * FROM clients WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY name ASC',
    [searchTerm, searchTerm, searchTerm],
    (err, clients) => {
      if (err) {
        return res.status(500).json({ error: 'Error en la búsqueda' });
      }
      res.json(clients);
    }
  );
});

module.exports = router;