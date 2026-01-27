'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TourismData extends Model {
    static associate(models) {
      // Add associations if needed
    }
  }

  TourismData.init(
    {
      location_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
        primaryKey: false
      },
      country: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      visitors: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      rating: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
      },
      revenue: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0
      },
      accommodation_available: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: 0
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pessimistic: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      average: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      optimistic: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      elasticity: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        comment: 'Price elasticity of demand calculated from previous year data'
      },
    },
    {
      sequelize,
      modelName: 'TourismData',
      tableName: 'tourism_data',
      timestamps: false,
    }
  );

  return TourismData;
};








