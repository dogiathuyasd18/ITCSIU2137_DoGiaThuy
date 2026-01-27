// models/paymenttype.js
'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PaymentType extends Model {
    static associate(models) {
      PaymentType.hasMany(models.UserPaymentMethod, { foreignKey: 'payment_type_id' });
    }
  }
  PaymentType.init({
    value: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    modelName: 'PaymentType',
    tableName: 'payment_types',
    timestamps: false,
  });
  return PaymentType;
};
