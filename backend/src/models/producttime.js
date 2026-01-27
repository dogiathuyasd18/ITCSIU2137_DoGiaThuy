// models/ProductTime.js

module.exports = (sequelize, DataTypes) => {
    const ProductTime = sequelize.define(
        "ProductTime",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },
            sku: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            time_travel: {
                type: DataTypes.DATE,
                allowNull: true
            },
            product_id: {
                type: DataTypes.INTEGER,
                allowNull: true
            }
        },
        {
            tableName: "product_time",
            timestamps: false
        }
    );

    ProductTime.associate = (models) => {
        ProductTime.belongsTo(models.Product, {
            foreignKey: "product_id",
            targetKey: "id"
        });
    };

    return ProductTime;
};
