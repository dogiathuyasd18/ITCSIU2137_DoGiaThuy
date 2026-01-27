// // models/productitem.js
// 'use strict';
// const { Model } = require('sequelize');

// module.exports = (sequelize, DataTypes) => {
//   class ProductItem extends Model {
//     static associate(models) {
//       ProductItem.belongsTo(models.Product, { foreignKey: 'product_id' });
//       ProductItem.hasMany(models.OrderLine, { foreignKey: 'product_item_id' });
//     }
//   }
//   ProductItem.init(
//     {
//       stock_keeping_unit: {
//         type: DataTypes.INTEGER,
//       },
//       quantity_in_stock: {
//         type: DataTypes.INTEGER,
//         // defaultValue: 30,
//       },
//       price: {
//         type: DataTypes.DECIMAL(5, 2),
//       },
//       name: {
//         type: DataTypes.STRING,
//       },
//       description: {
//         type: DataTypes.STRING
//       },
//       product_id:{
//         type: DataTypes.INTEGER
//       }
//     },
//     {
//       sequelize,
//       modelName: 'ProductItem',
//       tableName: 'product_item',
//       timestamps: false,
//     }
//   );
//   return ProductItem;
// };


'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductItem extends Model {
    static associate(models) {
      // Matches the fk_item_product_ref constraint
      ProductItem.belongsTo(models.Product, { foreignKey: 'product_id' });
      ProductItem.hasMany(models.OrderLine, { foreignKey: 'product_item_id' });
      ProductItem.hasMany(models.ProductSchedule, { foreignKey: 'product_item_id' });
    }
  }
  ProductItem.init(
    {
      // id is handled automatically by Sequelize as the Primary Key
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: false, // NOT NULL in SQL
      },
      stock_keeping_unit: {
        type: DataTypes.STRING(50), // Changed from INTEGER to varchar(50)
        allowNull: false,           // NOT NULL in SQL
        unique: true                // UNIQUE KEY idx_sku
      },
      price: {
        type: DataTypes.DECIMAL(15, 2), // Changed from (5, 2) to (15, 2) for billions
        allowNull: false,               // NOT NULL in SQL
      },
      description: {
        type: DataTypes.TEXT,           // Changed from STRING to TEXT
      }
      // REMOVED 'name' field - it does not exist in the SQL table for product_item
    },
    {
      sequelize,
      modelName: 'ProductItem',
      tableName: 'product_item',
      timestamps: false, // Matches your SQL structure
    }
  );
  return ProductItem;
};