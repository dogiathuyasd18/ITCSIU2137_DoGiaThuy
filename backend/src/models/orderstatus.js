'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderStatus extends Model {
    static associate(models) {
      // For example, if you want to define relationship to ShopOrder:
      OrderStatus.hasMany(models.ShopOrder, { foreignKey: 'order_status' });
    }
  }

  OrderStatus.init(
    {
      status: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'OrderStatus',
      tableName: 'order_status',
      timestamps: false,
    }
  );

  return OrderStatus;
};
