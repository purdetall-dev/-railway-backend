const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todos los presupuestos (admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM quotes ORDER BY created_at DESC',
    (err, quotes) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener los presupuestos' });
      }
      
      // Parsear el JSON de servicios
      const quotesWithParsedServices = quotes.map(quote => ({
        ...quote,
        services: quote.services ? JSON.parse(quote.services) : []
      }));
      
      res.json(quotesWithParsedServices);
    }
  );
});

// Obtener presupuestos por estado
router.get('/status/:status', authenticateToken, requireAdmin, (req, res) => {
  const { status } = req.params;
  
  db.all(
    'SELECT * FROM quotes WHERE status = ? ORDER BY created_at DESC',
    [status],
    (err, quotes) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener los presupuestos' });
      }
      
      const quotesWithParsedServices = quotes.map(quote => ({
        ...quote,
        services: quote.services ? JSON.parse(quote.services) : []
      }));
      
      res.json(quotesWithParsedServices);
    }
  );
});

// Crear nuevo presupuesto (público)
router.post('/', [
  body('client_name').notEmpty().withMessage('El nombre es requerido'),
  body('client_email').isEmail().withMessage('Email válido requerido'),
  body('services').isArray({ min: 1 }).withMessage('Debe seleccionar al menos un servicio')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      client_name,
      client_email,
      client_phone,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      services,
      message
    } = req.body;

    const servicesJson = JSON.stringify(services);

    db.run(
      `INSERT INTO quotes 
       (client_name, client_email, client_phone, vehicle_make, vehicle_model, 
        vehicle_year, services, message, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        client_name, client_email, client_phone, vehicle_make, 
        vehicle_model, vehicle_year, servicesJson, message
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al crear el presupuesto' });
        }
        
        res.status(201).json({
          success: true,
          message: 'Solicitud de presupuesto enviada correctamente. Te contactaremos pronto.',
          quoteId: this.lastID
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar presupuesto
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  body('status').isIn(['pending', 'quoted', 'accepted', 'rejected']).withMessage('Estado inválido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      status,
      quote_amount,
      admin_notes,
      valid_until
    } = req.body;

    db.run(
      'UPDATE quotes SET status = ?, quote_amount = ?, admin_notes = ?, valid_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, quote_amount, admin_notes, valid_until, id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar el presupuesto' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Presupuesto no encontrado' });
        }
        
        res.json({ success: true, message: 'Presupuesto actualizado correctamente' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar presupuesto
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM quotes WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar el presupuesto' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    
    res.json({ success: true, message: 'Presupuesto eliminado correctamente' });
  });
});

// Obtener un presupuesto por ID
router.get('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM quotes WHERE id = ?', [id], (err, quote) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el presupuesto' });
    }
    
    if (!quote) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    
    // Parsear servicios
    const quoteWithParsedServices = {
      ...quote,
      services: quote.services ? JSON.parse(quote.services) : []
    };
    
    res.json(quoteWithParsedServices);
  });
});

module.exports = router;