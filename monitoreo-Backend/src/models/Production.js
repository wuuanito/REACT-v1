// src/models/Production.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Production = sequelize.define('Production', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  machine_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  batch_id: {
    type: DataTypes.STRING
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_time: {
    type: DataTypes.DATE
  },
  units_produced: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  target_units: {
    type: DataTypes.INTEGER
  }
});

module.exports = Production;