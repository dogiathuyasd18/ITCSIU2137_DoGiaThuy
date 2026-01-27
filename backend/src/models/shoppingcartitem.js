'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ShoppingCartItem extends Model {
    static associate(models) {
      ShoppingCartItem.belongsTo(models.ShoppingCart, { foreignKey: 'cart_id' });
      ShoppingCartItem.belongsTo(models.ProductItem, { foreignKey: 'product_item_id' });
    }
  }
  ShoppingCartItem.init(
    {
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      cart_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      product_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'ShoppingCartItem',
      tableName: 'shopping_cart_items',
      timestamps: false,
    }
  );
  return ShoppingCartItem;
};
