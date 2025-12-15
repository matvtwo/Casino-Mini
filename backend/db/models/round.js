'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Round extends Model {
    static associate(models) {
      Round.hasMany(models.Bet, { foreignKey: 'roundId' });
    }
  }

  Round.init(
    {
      state: DataTypes.ENUM('IDLE', 'BETTING', 'SPINNING', 'RESULT'),
      result: DataTypes.JSONB,
      startedAt: DataTypes.DATE,
      finishedAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'Round' }
  );

  return Round;
};
