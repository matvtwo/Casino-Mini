'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Item extends Model {
    static associate(models) {
      Item.belongsToMany(models.User, {
        through: models.UserItem,
        foreignKey: 'itemId',
        otherKey: 'userId',
        as: 'owners',
      });
      Item.hasMany(models.UserItem, { foreignKey: 'itemId' });
    }
  }

  Item.init(
    {
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
      description: DataTypes.TEXT,
      price: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, modelName: 'Item' }
  );

  return Item;
};
