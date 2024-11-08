const WebSocket = require('ws');
const { MachineState, TimeLog } = require('../models');

class WSHandler {
  constructor() {
    this.connections = new Map();
    this.lastStates = new Map();
  }

  setup(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws) => {
      console.log('Nueva conexión WebSocket');
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(data);
        } catch (error) {
          console.error('Error procesando mensaje:', error);
        }
      });

      ws.on('close', () => {
        console.log('Conexión WebSocket cerrada');
      });
    });
  }

  async handleMessage(data) {
    try {
      // Guardar estado en la base de datos
      const machineState = await MachineState.create({
        timestamp: data.timestamp,
        state: this.determineState(data.estados),
        verde: data.estados.Verde,
        amarillo: data.estados.Amarillo,
        rojo: data.estados.Rojo,
        contador: data.estados.Contador,
        active_time: data.active_time,
        stopped_time: data.stopped_time
      });

      // Actualizar TimeLog si es necesario
      const currentState = this.determineState(data.estados);
      if (currentState !== 'idle') {
        await TimeLog.create({
          start_time: new Date(data.timestamp),
          state: currentState,
          duration: currentState === 'active' ? data.active_time : data.stopped_time
        });
      }

      console.log('Estado guardado:', machineState.id);
    } catch (error) {
      console.error('Error guardando estado:', error);
    }
  }

  determineState(estados) {
    if (estados.Verde) return 'active';
    if (estados.Rojo || estados.Amarillo) return 'stopped';
    return 'idle';
  }
}

module.exports = new WSHandler();