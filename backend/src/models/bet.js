import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class Bet extends Model {}

  Bet.init(
    {
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'Bet',
      tableName: 'Bets',
      underscored: true
    }
  );

  return Bet;
};

