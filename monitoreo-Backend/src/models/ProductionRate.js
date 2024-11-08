const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductionRate = sequelize.define('ProductionRate', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  production_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  units_per_minute: {
    type: DataTypes.FLOAT
  },
  units_count: {
    type: DataTypes.INTEGER
  },
  is_optimal: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});