// src/routes/api.js
const router = require('express').Router();
const { Machine, MachineState, TimeLog } = require('../models');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Endpoint para recibir estados de la máquina
router.post('/machine-state', async (req, res) => {
  try {
    console.log('Received data:', req.body);
    
    const {
      machine_id,
      estados,
      timestamp,
      state,
      active_time,
      stopped_time,
      units_count,
      production_stats,
      batch_id
    } = req.body;

    // Buscar o crear la máquina
    const [machine] = await Machine.findOrCreate({
      where: { id: machine_id },
      defaults: {
        name: 'Cremer 1',
        ip_address: '192.168.20.10',
        ws_port: 8765,
        status: 'active'
      }
    });

    // Guardar el estado de la máquina
    const machineState = await MachineState.create({
      machine_id: machine.id,
      timestamp: new Date(timestamp),
      state,
      verde: estados.Verde,
      amarillo: estados.Amarillo,
      rojo: estados.Rojo,
      contador: estados.Contador,
      active_time,
      stopped_time
    });

    // Si hay un cambio de estado, registrar en TimeLog
    if (state !== 'idle') {
      await TimeLog.create({
        machine_id: machine.id,
        start_time: new Date(timestamp),
        state,
        duration: state === 'active' ? active_time : stopped_time
      });
    }

    // Enviar respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Estado guardado correctamente',
      data: {
        machineState,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error procesando estado de máquina:', error);
    res.status(500).json({
      success: false,
      message: 'Error guardando estado',
      error: error.message
    });
  }
});

// Endpoint para iniciar producción
router.post('/production/start', async (req, res) => {
  try {
    const { machine_id, batch_id, start_time } = req.body;

    const production = await Production.create({
      machine_id,
      batch_id,
      start_time: new Date(start_time),
      units_produced: 0
    });

    res.status(201).json({
      success: true,
      data: production
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para finalizar producción
router.post('/production/:batch_id/end', async (req, res) => {
  try {
    const { units_produced, end_time, stats } = req.body;
    const { batch_id } = req.params;

    const production = await Production.findOne({
      where: { batch_id }
    });

    if (!production) {
      return res.status(404).json({
        success: false,
        message: 'Lote no encontrado'
      });
    }

    await production.update({
      units_produced,
      end_time: new Date(end_time),
      efficiency: stats.efficiency,
      rate_per_hour: stats.ratePerHour
    });

    res.json({
      success: true,
      data: production
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;