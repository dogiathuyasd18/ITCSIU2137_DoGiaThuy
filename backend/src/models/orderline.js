'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderLine extends Model {
    static associate(models) {
      OrderLine.belongsTo(models.ProductItem, { foreignKey: 'product_item_id' });
      OrderLine.belongsTo(models.ShopOrder, { foreignKey: 'order_id' });
      OrderLine.belongsTo(models.ProductSchedule, { foreignKey: 'schedule_id' });
    }
  }

  OrderLine.init(
    {
      product_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      price: {
        // Store VND price as integer (no decimals) to avoid out-of-range issues.
        // BIGINT supports large values safely in MySQL.
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      order_status_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1, // 1 = Pending/Ordered, 2 = Paid, 4 = Cancelled
      },
      schedule_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'product_schedule',
          key: 'id'
        },
      },
    },
    {
      sequelize,
      modelName: 'OrderLine',
      tableName: 'order_line',
      timestamps: false,
    }
  );

  return OrderLine;
};
