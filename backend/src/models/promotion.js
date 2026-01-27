// models/promotion.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Promotion extends Model {
    static associate(models) {
      Promotion.belongsToMany(models.ProductCategory, {
        through: 'promotion_category',
        foreignKey: 'promotion_id',
      });
    }
  }
  Promotion.init(
    {
      name: {
        type: DataTypes.TEXT,
      },
      discount_rate: {
        type: DataTypes.DECIMAL(5, 2),
      },
      start_date: {
        type: DataTypes.DATE,
      },
      end_date: {
        type: DataTypes.DATE,
      },
    },
    {
      sequelize,
      modelName: 'Promotion',
      tableName: 'promotion',
      timestamps: false,
    }
  );
  return Promotion;
};
