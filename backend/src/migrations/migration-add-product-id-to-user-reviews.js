'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('user_review', 'product_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow null for backward compatibility
      references: {
        model: 'product',
        key: 'id'
      },
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('user_review', 'product_id');
  }
};









