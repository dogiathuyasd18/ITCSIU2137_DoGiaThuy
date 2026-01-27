'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // In this repo the real table name is `order_line` (verified in MySQL).
    // Use changeColumn so existing data is preserved.
    await queryInterface.changeColumn('order_line', 'price', {
      type: Sequelize.BIGINT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to the original definition (DECIMAL(5,2))
    await queryInterface.changeColumn('order_line', 'price', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: true
    });
  }
};

