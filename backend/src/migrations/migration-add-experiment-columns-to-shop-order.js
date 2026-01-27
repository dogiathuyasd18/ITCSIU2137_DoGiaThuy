'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if columns exist before adding them
    const tableDescription = await queryInterface.describeTable('shop_order');
    
    if (!tableDescription.experiment_name) {
      await queryInterface.addColumn('shop_order', 'experiment_name', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }
    
    if (!tableDescription.variant) {
      await queryInterface.addColumn('shop_order', 'variant', {
        type: Sequelize.STRING(16),
        allowNull: true,
      });
    }
    
    if (!tableDescription.price_multiplier) {
      await queryInterface.addColumn('shop_order', 'price_multiplier', {
        type: Sequelize.DECIMAL(8, 4),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDescription = await queryInterface.describeTable('shop_order');
    
    if (tableDescription.experiment_name) {
      await queryInterface.removeColumn('shop_order', 'experiment_name');
    }
    
    if (tableDescription.variant) {
      await queryInterface.removeColumn('shop_order', 'variant');
    }
    
    if (tableDescription.price_multiplier) {
      await queryInterface.removeColumn('shop_order', 'price_multiplier');
    }
  }
};
