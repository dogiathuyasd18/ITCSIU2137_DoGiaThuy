'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Check if elasticity column already exists
      const [columns] = await queryInterface.describeTable('tourism_data');
      if (columns.elasticity) {
        console.log('elasticity column already exists in tourism_data table');
        return;
      }

      // Add elasticity column
      await queryInterface.addColumn('tourism_data', 'elasticity', {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: true,
        comment: 'Price elasticity of demand calculated from previous year data'
      });
      console.log('Successfully added elasticity column to tourism_data table');
    } catch (error) {
      console.error('Error adding elasticity column:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeColumn('tourism_data', 'elasticity');
      console.log('Successfully removed elasticity column from tourism_data table');
    } catch (error) {
      console.error('Error removing elasticity column:', error);
      throw error;
    }
  }
};
