'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Bet extends Model {
    static associate(models) {
      Bet.belongsTo(models.User, { foreignKey: 'userId' });
      Bet.belongsTo(models.Round, { foreignKey: 'roundId' });
    }
  }

  Bet.init(
    {
      amount: DataTypes.INTEGER,
      choice: DataTypes.STRING,
      payout: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
      roundId: DataTypes.INTEGER,
    },
    { sequelize, modelName: 'Bet' }
  );

  return Bet;
};
