const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todas las citas (admin)
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  const query = `
    SELECT a.*, s.title as service_title, c.name as client_name_db
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN clients c ON a.client_id = c.id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `;
  
  db.all(query, (err, appointments) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener las citas' });
    }
    res.json(appointments);
  });
});

// Obtener citas por estado
router.get('/status/:status', authenticateToken, requireAdmin, (req, res) => {
  const { status } = req.params;
  
  const query = `
    SELECT a.*, s.title as service_title, c.name as client_name_db
    FROM appointments a
    LEFT JOIN services s ON a.service_id = s.id
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE a.status = ?
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
  `;
  
  db.all(query, [status], (err, appointments) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener las citas' });
    }
    res.json(appointments);
  });
});

// Crear nueva cita (público)
router.post('/', [
  body('client_name').notEmpty().withMessage('El nombre es requerido'),
  body('client_phone').notEmpty().withMessage('El teléfono es requerido'),
  body('appointment_date').isISO8601().withMessage('Fecha válida requerida'),
  body('appointment_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora válida requerida')
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
      service_id,
      service_name,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      vehicle_color,
      appointment_date,
      appointment_time,
      notes
    } = req.body;

    // Verificar que la fecha/hora no esté ocupada
    db.get(
      'SELECT id FROM appointments WHERE appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
      [appointment_date, appointment_time],
      (err, existingAppointment) => {
        if (err) {
          return res.status(500).json({ error: 'Error al verificar disponibilidad' });
        }

        if (existingAppointment) {
          return res.status(400).json({ error: 'Esa fecha y hora ya están ocupadas' });
        }

        // Crear la cita
        db.run(
          `INSERT INTO appointments 
           (client_name, client_email, client_phone, service_id, service_name, 
            vehicle_make, vehicle_model, vehicle_year, vehicle_color, 
            appointment_date, appointment_time, notes, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            client_name, client_email, client_phone, service_id, service_name,
            vehicle_make, vehicle_model, vehicle_year, vehicle_color,
            appointment_date, appointment_time, notes
          ],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Error al crear la cita' });
            }
            
            res.status(201).json({
              success: true,
              message: 'Cita solicitada correctamente. Te contactaremos pronto para confirmar.',
              appointmentId: this.lastID
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar estado de cita
router.put('/:id/status', [
  authenticateToken,
  requireAdmin,
  body('status').isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled']).withMessage('Estado inválido')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    const updateQuery = notes 
      ? 'UPDATE appointments SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      : 'UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    
    const params = notes ? [status, notes, id] : [status, id];

    db.run(updateQuery, params, function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al actualizar la cita' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Cita no encontrada' });
      }
      
      res.json({ success: true, message: 'Estado de cita actualizado correctamente' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar cita completa
router.put('/:id', [
  authenticateToken,
  requireAdmin,
  body('client_name').notEmpty().withMessage('El nombre es requerido'),
  body('client_phone').notEmpty().withMessage('El teléfono es requerido'),
  body('appointment_date').isISO8601().withMessage('Fecha válida requerida'),
  body('appointment_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora válida requerida')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      client_name,
      client_email,
      client_phone,
      service_id,
      service_name,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      vehicle_color,
      appointment_date,
      appointment_time,
      status,
      notes,
      price
    } = req.body;

    db.run(
      `UPDATE appointments SET 
       client_name = ?, client_email = ?, client_phone = ?, service_id = ?, service_name = ?,
       vehicle_make = ?, vehicle_model = ?, vehicle_year = ?, vehicle_color = ?,
       appointment_date = ?, appointment_time = ?, status = ?, notes = ?, price = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        client_name, client_email, client_phone, service_id, service_name,
        vehicle_make, vehicle_model, vehicle_year, vehicle_color,
        appointment_date, appointment_time, status, notes, price, id
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar la cita' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Cita no encontrada' });
        }
        
        res.json({ success: true, message: 'Cita actualizada correctamente' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar cita
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM appointments WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar la cita' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    res.json({ success: true, message: 'Cita eliminada correctamente' });
  });
});

// Obtener horas disponibles para una fecha
router.get('/available-times/:date', (req, res) => {
  const { date } = req.params;
  
  // Horarios de trabajo (9:00 - 18:00, intervalos de 1 hora)
  const workingHours = [
    '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00'
  ];
  
  // Obtener citas ocupadas para esa fecha
  db.all(
    'SELECT appointment_time FROM appointments WHERE appointment_date = ? AND status != "cancelled"',
    [date],
    (err, appointments) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar disponibilidad' });
      }
      
      const bookedTimes = appointments.map(apt => apt.appointment_time);
      const availableTimes = workingHours.filter(time => !bookedTimes.includes(time));
      
      res.json({ availableTimes });
    }
  );
});

module.exports = router;