const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');

// Definir modelos
const Machine = sequelize.define('Machine', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING
  },
  ws_port: {
    type: DataTypes.INTEGER
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
    defaultValue: 'active'
  }
}, {
  tableName: 'machines'
});

const MachineState = sequelize.define('MachineState', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  machine_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false
  },
  verde: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  amarillo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rojo: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  contador: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  active_time: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  stopped_time: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  }
}, {
  tableName: 'machine_states'
});

const TimeLog = sequelize.define('TimeLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  machine_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false
  },
  duration: {
    type: DataTypes.FLOAT
  }
}, {
  tableName: 'time_logs'
});

// Definir relaciones
Machine.hasMany(MachineState, { foreignKey: 'machine_id' });
MachineState.belongsTo(Machine, { foreignKey: 'machine_id' });

Machine.hasMany(TimeLog, { foreignKey: 'machine_id' });
TimeLog.belongsTo(Machine, { foreignKey: 'machine_id' });

// Función para inicializar la base de datos
const initializeDatabase = async (force = false) => {
  try {
    // Sincronizar modelos con la base de datos
    await sequelize.sync({ force });
    console.log('Database synchronized');

    // Crear máquina por defecto si no existe
    const [machine] = await Machine.findOrCreate({
      where: { name: 'Cremer 1' },
      defaults: {
        ip_address: '192.168.20.10',
        ws_port: 8765,
        status: 'active'
      }
    });

    console.log('Default machine created or found:', machine.toJSON());
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  Machine,
  MachineState,
  TimeLog,
  initializeDatabase
};