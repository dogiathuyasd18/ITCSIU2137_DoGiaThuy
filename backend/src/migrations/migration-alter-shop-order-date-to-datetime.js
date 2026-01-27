'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Your codebase uses `shop_order` in raw SQL, but some older migrations used `shop_orders`.
    // We attempt both so the migration works in either schema.
    let tableName = 'shop_order';
    try {
      await queryInterface.describeTable(tableName);
    } catch (e) {
      tableName = 'shop_orders';
      await queryInterface.describeTable(tableName);
    }

    // Backfill NULL values (if any) so we can safely enforce NOT NULL.
    await queryInterface.sequelize.query(
      `UPDATE \`${tableName}\` SET order_date = CURRENT_TIMESTAMP(3) WHERE order_date IS NULL`
    );

    // Convert from DATEONLY -> DATETIME(3) so we store exact booking time.
    await queryInterface.changeColumn(tableName, 'order_date', {
      type: Sequelize.DATE(3),
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
    });
  },

  down: async (queryInterface, Sequelize) => {
    let tableName = 'shop_order';
    try {
      await queryInterface.describeTable(tableName);
    } catch (e) {
      tableName = 'shop_orders';
      await queryInterface.describeTable(tableName);
    }

    // Revert to DATEONLY if needed (time will be lost).
    await queryInterface.changeColumn(tableName, 'order_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },
};


