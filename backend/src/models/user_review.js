// models/user_review.js
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserReview extends Model {
    static associate(models) {
      UserReview.belongsTo(models.User, { foreignKey: 'user_id' });
      UserReview.belongsTo(models.Product, { foreignKey: 'product_id' });
    }
  }
  UserReview.init({
    user_id: { 
      type: DataTypes.INTEGER, 
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'product',
        key: 'id'
      }
    },
    rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    comment: DataTypes.TEXT,
  }, {
    sequelize,
    modelName: 'UserReview',
    tableName: 'user_review',
    timestamps: true,
  });
  return UserReview;
};
