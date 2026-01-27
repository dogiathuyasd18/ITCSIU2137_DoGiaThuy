// 'use strict';
// const { Model } = require('sequelize');

// module.exports = (sequelize, DataTypes) => {
//   class ProductCategory extends Model {
//     static associate(models) {
//       ProductCategory.hasMany(models.Product, { foreignKey: 'category_id' });
//       ProductCategory.belongsToMany(models.Promotion, {
//         through: 'promotion_category',
//         foreignKey: 'category_id',
//         otherKey: 'promotion_id',
//       });

//     }
//   }

//   ProductCategory.init(
//     {
//       category_name: {
//         type: DataTypes.TEXT,
//         allowNull: false,
//       },
//     },
//     {
//       sequelize,
//       modelName: 'ProductCategory',
//       tableName: 'product_category',
//       timestamps: false,
//     }
//   );

//   return ProductCategory;
// };


'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductCategory extends Model {
    static associate(models) {
      ProductCategory.hasMany(models.Product, { foreignKey: 'category_id' });
    }
  }
  ProductCategory.init({
    category_name: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'ProductCategory', // Critical for associations
    tableName: 'product_category',
    timestamps: false,
  });
  return ProductCategory;
};