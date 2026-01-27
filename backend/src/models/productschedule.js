'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductSchedule extends Model {
    static associate(models) {
      ProductSchedule.belongsTo(models.ProductItem, { 
        foreignKey: 'product_item_id',
        targetKey: 'id'
      });
    }
  }
  
  ProductSchedule.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    product_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'product_item',
        key: 'id'
      }
    },
    travel_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'ProductSchedule',
    tableName: 'product_schedule',
    timestamps: false
  });
  
  return ProductSchedule;
};

