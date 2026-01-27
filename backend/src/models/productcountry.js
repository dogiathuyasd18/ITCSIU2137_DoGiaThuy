'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductCountry extends Model {
    static associate(models) {
      ProductCountry.hasMany(models.Product, { foreignKey: 'country_id' });
    }
  }
  ProductCountry.init({
    country_name: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'ProductCountry', // Must match Product.belongsTo(models.ProductCountry)
    tableName: 'product_country',
    timestamps: false,
  });
  return ProductCountry;
};