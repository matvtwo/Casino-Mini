'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserItem extends Model {
    static associate(models) {
      UserItem.belongsTo(models.User, { foreignKey: 'userId' });
      UserItem.belongsTo(models.Item, { foreignKey: 'itemId' });
    }
  }

  UserItem.init(
    {
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      userId: DataTypes.INTEGER,
      itemId: DataTypes.INTEGER,
    },
    { sequelize, modelName: 'UserItem' }
  );

  return UserItem;
};
