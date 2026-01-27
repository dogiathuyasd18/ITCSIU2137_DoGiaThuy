'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ShopOrder extends Model {
    static associate(models) {
      ShopOrder.belongsTo(models.User, { foreignKey: 'user_id' });
      ShopOrder.belongsTo(models.UserPaymentMethod, { foreignKey: 'payment_method_id' });
      ShopOrder.belongsTo(models.OrderStatus, {
        foreignKey: 'order_status',
        targetKey: 'status', // because it's referencing a UNIQUE `status` field, not `id`
      });
      ShopOrder.hasMany(models.OrderLine, { foreignKey: 'order_id' });
    }
  }

  ShopOrder.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      order_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      payment_method_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      order_total: {
        // Store VND totals as integer (no decimals) to support large values.
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      order_status: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      promotion_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      experiment_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      variant: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      price_multiplier: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: 'ShopOrder',
      tableName: 'shop_order',
      timestamps: false,
    }
  );

  return ShopOrder;
};
