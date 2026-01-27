// models/productmetrics.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductMetrics extends Model {

    static associate(models) {
      ProductMetrics.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product', 
      });
    }
  }
  ProductMetrics.init(
    {
      product_id: {
        type: DataTypes.INTEGER,
        primaryKey: true, 
        allowNull: false,
      },
      revenue: {
        type: DataTypes.DECIMAL(5, 2), 
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true, 
      },
      percent: {
        type: DataTypes.DECIMAL(5, 2), 
        allowNull: true, 
      },
      rating: {
        type: DataTypes.DECIMAL(2, 1), 
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'ProductMetrics', 
      tableName: 'product_metrics', 
      timestamps: false, 
    }
  );
  return ProductMetrics;
};