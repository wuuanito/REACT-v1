// src/models/MachineState.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
});

module.exports = MachineState;
