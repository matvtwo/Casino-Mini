import { DataTypes, Model } from 'sequelize';

export default (sequelize) => {
  class Round extends Model {}

  Round.init(
    {
      result: {
        type: DataTypes.JSONB,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'Round',
      tableName: 'Rounds',
      underscored: true
    }
  );

  return Round;
};

