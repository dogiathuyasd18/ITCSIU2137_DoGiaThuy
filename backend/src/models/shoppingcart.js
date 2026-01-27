// models/shoppingcart.js
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ShoppingCart extends Model {
    static associate(models) {
      ShoppingCart.belongsTo(models.User, { foreignKey: 'user_id' });
      ShoppingCart.hasMany(models.ShoppingCartItem, { foreignKey: 'cart_id' });
    }
  }
  ShoppingCart.init({}, {
    sequelize,
    modelName: 'ShoppingCart',
    tableName: 'shopping_carts',
    timestamps: true,
  });
  return ShoppingCart;
};
