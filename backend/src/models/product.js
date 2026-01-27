// // models/product.js
// 'use strict';
// const { Model } = require('sequelize');

// module.exports = (sequelize, DataTypes) => {
//   class Product extends Model {
//     static associate(models) {
//       Product.belongsTo(models.ProductCategory, { foreignKey: 'category_id' });
//       Product.hasMany(models.ProductItem, { foreignKey: 'product_id' });
//     }
//   }
//   Product.init(
//     {
//       name: {
//         type: DataTypes.TEXT,
//       },
//       category_id: {
//         type: DataTypes.INTEGER,
//         allowNull: false,
//       },
//     },
//     {
//       sequelize,
//       modelName: 'Product',
//       tableName: 'product',
//       timestamps: false,
//     }
//   );
//   return Product;
// };


'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      Product.belongsTo(models.ProductCategory, { foreignKey: 'category_id' });
      Product.belongsTo(models.ProductCountry, { foreignKey: 'country_id' }); 
      Product.hasMany(models.ProductItem, { foreignKey: 'product_id' });
    }
  }
  Product.init({
    name: { type: DataTypes.STRING(255), allowNull: false },
    category_id: DataTypes.INTEGER,
    country_id: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'Product',
    tableName: 'product',
    timestamps: false,
  });
  return Product;
};