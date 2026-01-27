'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('shop_orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users', // Match your user table name
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      order_date: {
        // Store exact booking timestamp (date + time). DATEONLY would drop time and cause timezone shifts like 07:00.
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)')
      },
      payment_method_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'user_payment_methods', // Match your user_payment_method table name
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      order_total: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true
      },
      order_status: {
        type: Sequelize.STRING(255),
        allowNull: true,
        references: {
          model: 'order_statuses', // Match your order_status table name
          key: 'status'
        },
        onDelete: 'CASCADE'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('shop_orders');
  }
};
