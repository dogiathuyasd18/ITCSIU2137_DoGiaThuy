'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('order_lines', 'schedule_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'product_schedule',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'order_status_id'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('order_lines', 'schedule_id');
  }
};


