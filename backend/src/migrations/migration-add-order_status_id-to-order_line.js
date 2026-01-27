'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('order_lines', 'order_status_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1, // 1 = Pending/Ordered, 2 = Paid, 4 = Cancelled
      after: 'price'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('order_lines', 'order_status_id');
  }
};


