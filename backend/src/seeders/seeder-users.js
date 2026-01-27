'use strict';

const bcrypt = require('bcryptjs');

module.exports = {


  up: async (queryInterface, Sequelize) => {
    // Hash the password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('123456', salt);
    
    return queryInterface.bulkInsert('Users', [{
      email: 'admin@gmail.com',
      password: hashedPassword,
      firstName: 'Nguyen',
      lastName: 'Rin',
      address: 'HCM',
      gender: 'male',
      roleId: 2, // Admin role
      phone_number: '0123456789',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      email: 'customer@gmail.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Doe',
      address: 'HCM',
      gender: 'female',
      roleId: 1, // Customer role
      phone_number: '0987654321',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
