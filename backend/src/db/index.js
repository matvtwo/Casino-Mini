import { Sequelize } from 'sequelize';
import { DATABASE_URL } from '../config.js';
import initUser from '../models/user.js';
import initBet from '../models/bet.js';
import initRound from '../models/round.js';

export const sequelize = new Sequelize(DATABASE_URL, {
  logging: false,
  dialect: 'postgres',
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false
  }
});

const models = {};
models.User = initUser(sequelize);
models.Round = initRound(sequelize);
models.Bet = initBet(sequelize);

models.User.hasMany(models.Bet, { foreignKey: 'userId' });
models.Bet.belongsTo(models.User, { foreignKey: 'userId' });

models.Round.hasMany(models.Bet, { foreignKey: 'roundId' });
models.Bet.belongsTo(models.Round, { foreignKey: 'roundId' });

export default models;

