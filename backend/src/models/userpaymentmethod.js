// models/userpaymentmethod.js
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserPaymentMethod extends Model {
    static associate(models) {
      UserPaymentMethod.belongsTo(models.User, { foreignKey: 'user_id' });
      UserPaymentMethod.belongsTo(models.PaymentType, { foreignKey: 'payment_type_id' });
    }
  }
  UserPaymentMethod.init({
    provider: { type: DataTypes.TEXT, allowNull: true },
    payment_type_id: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'UserPaymentMethod',
    tableName: 'user_payment_method',
    timestamps: false,
  });
  return UserPaymentMethod;
};
